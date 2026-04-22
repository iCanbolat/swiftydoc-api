import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import type { IntegrationExternalReferenceSnapshot } from '../../common/integrations/integration-external-reference';
import {
  type AccountingErpSyncPayload,
  isAccountingErpSyncPayload,
  type AccountingErpCustomerRecord,
  type IntegrationSyncAddress,
} from '../../common/integrations/integration-sync-payload';
import type {
  IntegrationConnectionTestResult,
  IntegrationConnector,
  IntegrationConnectorContext,
  IntegrationSyncResult,
} from './integration-connector.types';

interface ZohoBooksCredentials {
  accessToken?: string;
  organizationId?: string;
  baseUrl: string;
}

interface ZohoBooksOrganizationSummary {
  currency_code?: string;
  is_default_org?: boolean;
  name?: string;
  organization_id?: string;
}

interface ZohoBooksOrganizationsResponse {
  code?: number;
  message?: string;
  organizations?: ZohoBooksOrganizationSummary[];
}

interface ZohoBooksContactSummary {
  contact_id?: string;
  contact_name?: string;
}

interface ZohoBooksContactResponse {
  code?: number;
  contact?: ZohoBooksContactSummary;
  message?: string;
}

@Injectable()
export class ZohoBooksIntegrationConnector implements IntegrationConnector {
  readonly providerKey = 'zoho_books' as const;

  constructor(
    private readonly configService: ConfigService<RuntimeEnv, true>,
  ) {}

  async testConnection(
    context: IntegrationConnectorContext,
  ): Promise<IntegrationConnectionTestResult> {
    const credentials = this.resolveCredentials(context.settings);

    if (!credentials.accessToken || !credentials.organizationId) {
      if (this.isProduction()) {
        throw new ServiceUnavailableException(
          'Zoho Books credentials are missing for production integration testing.',
        );
      }

      return {
        success: true,
        status: 'connected',
        mode: 'simulated',
        message: 'Simulated Zoho Books connection test succeeded.',
        metadata: {
          mode: 'simulated',
          reason: 'missing_credentials',
        },
      };
    }

    const response = await this.fetchOrganizations(credentials);
    const organization = response.organizations?.find(
      (entry) => entry.organization_id === credentials.organizationId,
    );

    if (!organization) {
      throw new ServiceUnavailableException(
        'Zoho Books connection test failed: configured organization was not found for the provided token.',
      );
    }

    return {
      success: true,
      status: 'connected',
      mode: 'live',
      message: 'Zoho Books connection test succeeded.',
      metadata: {
        organizationId: organization.organization_id ?? credentials.organizationId,
        organizationName: organization.name ?? null,
        currencyCode: organization.currency_code ?? null,
        isDefaultOrganization: organization.is_default_org ?? false,
      },
    };
  }

  async sync(context: IntegrationConnectorContext): Promise<IntegrationSyncResult> {
    const testResult = await this.testConnection(context);
    const payload = context.syncPayload;

    if (testResult.mode === 'simulated') {
      return {
        status: 'succeeded',
        mode: testResult.mode,
        message: 'Simulated Zoho Books sync completed.',
        metadata: {
          ...testResult.metadata,
          syncScope: 'organization_profile',
        },
      };
    }

    if (
      !isAccountingErpSyncPayload(payload) ||
      payload.entityType !== 'customer' ||
      !payload.customer
    ) {
      return {
        status: 'succeeded',
        mode: testResult.mode,
        message: 'Zoho Books organization metadata sync completed.',
        metadata: {
          ...testResult.metadata,
          syncScope: 'organization_profile',
        },
      };
    }

    const credentials = this.resolveCredentials(context.settings);
    const externalId =
      context.externalReference?.externalId ?? payload.destination?.externalId;
    const contactResponse = await this.upsertCustomer(
      credentials,
      payload.customer,
      externalId,
    );
    const resolvedExternalId =
      contactResponse.contact?.contact_id ?? externalId?.trim() ?? null;

    return {
      status: 'succeeded',
      mode: 'live',
      message: 'Zoho Books customer sync completed.',
      metadata: {
        ...testResult.metadata,
        syncScope: 'customer',
        entityType: payload.entityType,
        operation: payload.operation,
        externalId: resolvedExternalId,
        contactName:
          contactResponse.contact?.contact_name ?? payload.customer.displayName,
        sourceResourceType: payload.source.resourceType,
        sourceResourceId: payload.source.resourceId,
      },
      externalReference: resolvedExternalId
        ? this.buildExternalReference(
            payload,
            resolvedExternalId,
            contactResponse,
            context.externalReference?.externalReferenceKey ??
              payload.destination?.externalReferenceKey,
          )
        : undefined,
    };
  }

  private async fetchOrganizations(
    credentials: ZohoBooksCredentials,
  ): Promise<ZohoBooksOrganizationsResponse> {
    const response = await fetch(this.buildUrl(credentials.baseUrl, '/organizations'), {
      method: 'GET',
      headers: this.buildHeaders(credentials.accessToken),
    });

    const responseBody =
      await this.parseJson<ZohoBooksOrganizationsResponse>(response);

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Zoho Books connection test failed (${response.status}): ${responseBody.message ?? 'Unknown provider error'}`,
      );
    }

    return responseBody;
  }

  private async upsertCustomer(
    credentials: ZohoBooksCredentials,
    customer: AccountingErpCustomerRecord,
    externalId?: string,
  ): Promise<ZohoBooksContactResponse> {
    if (!credentials.accessToken || !credentials.organizationId) {
      throw new ServiceUnavailableException(
        'Zoho Books credentials are incomplete for customer sync.',
      );
    }

    const normalizedExternalId = externalId?.trim();
    const path = normalizedExternalId
      ? `/contacts/${normalizedExternalId}`
      : '/contacts';
    const method = normalizedExternalId ? 'PUT' : 'POST';
    const response = await fetch(
      this.buildUrl(credentials.baseUrl, path, credentials.organizationId),
      {
        method,
        headers: this.buildHeaders(credentials.accessToken),
        body: JSON.stringify(this.mapCustomerPayload(customer)),
      },
    );

    const responseBody = await this.parseJson<ZohoBooksContactResponse>(response);

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Zoho Books customer sync failed (${response.status}): ${responseBody.message ?? 'Unknown provider error'}`,
      );
    }

    return responseBody;
  }

  private mapCustomerPayload(customer: AccountingErpCustomerRecord) {
    return {
      billing_address: this.mapAddress(customer.billingAddress),
      company_name: customer.companyName ?? customer.displayName,
      contact_name: customer.displayName,
      contact_persons:
        customer.contactPersons
          ?.map((person) => this.mapContactPerson(person))
          .filter((person) => person !== null) ?? [],
      contact_type: 'customer',
      currency_code: customer.currencyCode,
      email: customer.email,
      notes: customer.notes,
      phone: customer.phone,
      shipping_address: this.mapAddress(customer.shippingAddress),
    };
  }

  private buildExternalReference(
    payload: AccountingErpSyncPayload,
    externalId: string,
    contactResponse: ZohoBooksContactResponse,
    externalReferenceKey?: string,
  ): IntegrationExternalReferenceSnapshot {
    return {
      localResourceType: payload.source.resourceType,
      localResourceId: payload.source.resourceId,
      externalObjectType: payload.entityType,
      externalId,
      externalReferenceKey,
      metadata: {
        contactName:
          contactResponse.contact?.contact_name ?? payload.customer?.displayName ?? null,
        sourceDisplayName: payload.source.displayName ?? null,
      },
    };
  }

  private mapAddress(address?: IntegrationSyncAddress) {
    if (!address) {
      return undefined;
    }

    return {
      address: [address.addressLine1, address.addressLine2]
        .filter((value) => typeof value === 'string' && value.trim().length > 0)
        .join(', '),
      city: address.city,
      country: address.countryCode,
      state: address.state,
      zip: address.postalCode,
    };
  }

  private mapContactPerson(
    person: AccountingErpCustomerRecord['contactPersons'] extends
      | Array<infer ContactPerson>
      | undefined
      ? ContactPerson
      : never,
  ) {
    const fullName = person.fullName?.trim();
    const derivedNameParts = fullName ? fullName.split(/\s+/) : [];
    const firstName = person.firstName?.trim() || derivedNameParts[0];
    const lastName = person.lastName?.trim() || derivedNameParts.slice(1).join(' ');

    if (!firstName && !lastName && !person.email && !person.phone) {
      return null;
    }

    return {
      email: person.email,
      first_name: firstName,
      last_name: lastName,
      mobile: person.phone,
    };
  }

  private resolveCredentials(source: Record<string, unknown>): ZohoBooksCredentials {
    return {
      accessToken:
        this.readString(source, 'accessToken') ??
        this.configService.get('ZOHO_BOOKS_ACCESS_TOKEN', { infer: true }),
      organizationId:
        this.readString(source, 'organizationId') ??
        this.configService.get('ZOHO_BOOKS_ORGANIZATION_ID', {
          infer: true,
        }),
      baseUrl:
        this.readString(source, 'baseUrl') ??
        this.configService.get('ZOHO_BOOKS_API_BASE_URL', { infer: true }) ??
        'https://www.zohoapis.com/books/v3',
    };
  }

  private buildHeaders(accessToken?: string): HeadersInit {
    if (!accessToken) {
      throw new BadRequestException('Zoho Books access token is required.');
    }

    return {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private buildUrl(
    baseUrl: string,
    path: string,
    organizationId?: string,
  ): string {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);

    if (organizationId) {
      url.searchParams.set('organization_id', organizationId);
    }

    return url.toString();
  }

  private async parseJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      return {} as T;
    }
  }

  private readString(
    source: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = source[key];

    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private isProduction(): boolean {
    return this.configService.get('NODE_ENV', { infer: true }) === 'production';
  }
}