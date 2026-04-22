import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
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

interface OdooCredentials {
  apiBaseUrl?: string;
  database?: string;
  username?: string;
  password?: string;
}

interface OdooJsonRpcError {
  message?: string;
  data?: {
    debug?: string;
    message?: string;
  };
}

interface OdooJsonRpcResponse<T> {
  error?: OdooJsonRpcError;
  result?: T;
}

interface OdooUserRecord {
  company_id?: [number, string] | false;
  id: number;
  login?: string;
  name?: string;
}

interface OdooPartnerRecord {
  email?: string;
  id: number;
  name?: string;
}

interface OdooCountryRecord {
  id: number;
}

@Injectable()
export class OdooIntegrationConnector implements IntegrationConnector {
  readonly providerKey = 'odoo' as const;

  constructor(
    private readonly configService: ConfigService<RuntimeEnv, true>,
  ) {}

  async testConnection(
    context: IntegrationConnectorContext,
  ): Promise<IntegrationConnectionTestResult> {
    const credentials = this.resolveCredentials(context.settings);

    if (
      !credentials.apiBaseUrl ||
      !credentials.database ||
      !credentials.username ||
      !credentials.password
    ) {
      if (this.isProduction()) {
        throw new ServiceUnavailableException(
          'Odoo credentials are missing for production integration testing.',
        );
      }

      return {
        success: true,
        status: 'connected',
        mode: 'simulated',
        message: 'Simulated Odoo connection test succeeded.',
        metadata: {
          mode: 'simulated',
          reason: 'missing_credentials',
        },
      };
    }

    const uid = await this.authenticate(credentials);
    const [user] = await this.executeKw<OdooUserRecord[]>(
      credentials,
      uid,
      'res.users',
      'read',
      [[uid]],
      {
        fields: ['name', 'login', 'company_id'],
      },
    );
    const partnerCount = await this.executeKw<number>(
      credentials,
      uid,
      'res.partner',
      'search_count',
      [[]],
    );

    return {
      success: true,
      status: 'connected',
      mode: 'live',
      message: 'Odoo connection test succeeded.',
      metadata: {
        companyName: Array.isArray(user?.company_id)
          ? user.company_id[1]
          : null,
        database: credentials.database,
        partnerCount,
        userLogin: user?.login ?? credentials.username,
        userName: user?.name ?? null,
        uid,
      },
    };
  }

  async sync(
    context: IntegrationConnectorContext,
  ): Promise<IntegrationSyncResult> {
    const testResult = await this.testConnection(context);
    const payload = context.syncPayload;

    if (testResult.mode === 'simulated') {
      return {
        status: 'succeeded',
        mode: 'simulated',
        message: 'Simulated Odoo sync completed.',
        metadata: {
          ...testResult.metadata,
          syncScope: 'instance_profile',
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
        message: 'Odoo instance metadata sync completed.',
        metadata: {
          ...testResult.metadata,
          syncScope: 'instance_profile',
        },
      };
    }

    const credentials = this.resolveCredentials(context.settings);
    const uid = await this.authenticate(credentials);
    const customerValues = await this.mapCustomerPayload(
      credentials,
      uid,
      payload.customer,
    );
    const existingExternalId =
      context.externalReference?.externalId ?? payload.destination?.externalId;
    const normalizedExternalId = this.parseExternalId(existingExternalId);

    let partnerId: number;

    if (normalizedExternalId !== undefined) {
      const updated = await this.executeKw<boolean>(
        credentials,
        uid,
        'res.partner',
        'write',
        [[normalizedExternalId], customerValues],
      );

      if (!updated) {
        throw new ServiceUnavailableException(
          `Odoo customer sync failed: partner ${normalizedExternalId} could not be updated.`,
        );
      }

      partnerId = normalizedExternalId;
    } else {
      partnerId = await this.executeKw<number>(
        credentials,
        uid,
        'res.partner',
        'create',
        [customerValues],
      );
    }

    const [partner] = await this.executeKw<OdooPartnerRecord[]>(
      credentials,
      uid,
      'res.partner',
      'read',
      [[partnerId]],
      {
        fields: ['name', 'email'],
      },
    );

    return {
      status: 'succeeded',
      mode: 'live',
      message: 'Odoo customer sync completed.',
      metadata: {
        ...testResult.metadata,
        entityType: payload.entityType,
        externalId: String(partnerId),
        operation: payload.operation,
        partnerEmail: partner?.email ?? payload.customer.email ?? null,
        partnerName: partner?.name ?? payload.customer.displayName,
        sourceResourceId: payload.source.resourceId,
        sourceResourceType: payload.source.resourceType,
        syncScope: 'customer',
      },
      externalReference: this.buildExternalReference(
        payload,
        partnerId,
        partner,
        context.externalReference?.externalReferenceKey ??
          payload.destination?.externalReferenceKey,
      ),
    };
  }

  private async authenticate(credentials: OdooCredentials): Promise<number> {
    if (
      !credentials.database ||
      !credentials.username ||
      !credentials.password
    ) {
      throw new ServiceUnavailableException(
        'Odoo credentials are incomplete for authentication.',
      );
    }

    const uid = await this.callJsonRpc<number | false>(
      credentials,
      'common',
      'authenticate',
      [credentials.database, credentials.username, credentials.password, {}],
    );

    if (typeof uid !== 'number' || uid <= 0) {
      throw new ServiceUnavailableException(
        'Odoo authentication failed for the supplied credentials.',
      );
    }

    return uid;
  }

  private async executeKw<T>(
    credentials: OdooCredentials,
    uid: number,
    model: string,
    method: string,
    methodArgs: unknown[],
    methodKwargs?: Record<string, unknown>,
  ): Promise<T> {
    if (!credentials.database || !credentials.password) {
      throw new ServiceUnavailableException(
        'Odoo credentials are incomplete for model access.',
      );
    }

    const args: unknown[] = [
      credentials.database,
      uid,
      credentials.password,
      model,
      method,
      methodArgs,
    ];

    if (methodKwargs) {
      args.push(methodKwargs);
    }

    return this.callJsonRpc<T>(credentials, 'object', 'execute_kw', args);
  }

  private async callJsonRpc<T>(
    credentials: OdooCredentials,
    service: 'common' | 'object',
    method: string,
    args: unknown[],
  ): Promise<T> {
    if (!credentials.apiBaseUrl) {
      throw new BadRequestException('Odoo API base URL is required.');
    }

    const response = await fetch(
      `${credentials.apiBaseUrl.replace(/\/$/, '')}/jsonrpc`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: randomUUID(),
          jsonrpc: '2.0',
          method: 'call',
          params: {
            args,
            method,
            service,
          },
        }),
      },
    );

    const responseBody = await this.parseJson<OdooJsonRpcResponse<T>>(response);

    if (!response.ok || responseBody.error || !('result' in responseBody)) {
      const errorMessage =
        responseBody.error?.data?.message ??
        responseBody.error?.message ??
        'Unknown provider error';

      throw new ServiceUnavailableException(
        `Odoo request failed (${response.status}): ${errorMessage}`,
      );
    }

    return responseBody.result as T;
  }

  private async mapCustomerPayload(
    credentials: OdooCredentials,
    uid: number,
    customer: AccountingErpCustomerRecord,
  ): Promise<Record<string, unknown>> {
    return {
      city: customer.billingAddress?.city,
      comment: this.buildComment(customer),
      company_type: 'company',
      country_id: await this.resolveCountryId(
        credentials,
        uid,
        customer.billingAddress?.countryCode ??
          customer.shippingAddress?.countryCode,
      ),
      email: customer.email,
      is_company: true,
      name: customer.companyName ?? customer.displayName,
      phone: customer.phone,
      street: customer.billingAddress?.addressLine1,
      street2: customer.billingAddress?.addressLine2,
      vat: customer.taxRegistrationNumber,
      zip: customer.billingAddress?.postalCode,
    };
  }

  private buildComment(
    customer: AccountingErpCustomerRecord,
  ): string | undefined {
    const lines = [customer.notes?.trim()];

    for (const person of customer.contactPersons ?? []) {
      const fullName =
        person.fullName?.trim() ||
        [person.firstName?.trim(), person.lastName?.trim()]
          .filter((value) => value && value.length > 0)
          .join(' ');
      const parts = [fullName, person.role, person.email, person.phone].filter(
        (value) => typeof value === 'string' && value.trim().length > 0,
      );

      if (parts.length > 0) {
        lines.push(`Contact: ${parts.join(' | ')}`);
      }
    }

    const normalized = lines
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      )
      .join('\n');

    return normalized.length > 0 ? normalized : undefined;
  }

  private buildExternalReference(
    payload: AccountingErpSyncPayload,
    partnerId: number,
    partner: OdooPartnerRecord | undefined,
    externalReferenceKey?: string,
  ): IntegrationExternalReferenceSnapshot {
    return {
      externalId: String(partnerId),
      externalObjectType: payload.entityType,
      externalReferenceKey,
      localResourceId: payload.source.resourceId,
      localResourceType: payload.source.resourceType,
      metadata: {
        partnerEmail: partner?.email ?? null,
        partnerName: partner?.name ?? payload.customer?.displayName ?? null,
        sourceDisplayName: payload.source.displayName ?? null,
      },
    };
  }

  private async resolveCountryId(
    credentials: OdooCredentials,
    uid: number,
    countryCode?: string,
  ): Promise<number | undefined> {
    const normalizedCountryCode = countryCode?.trim().toUpperCase();

    if (!normalizedCountryCode) {
      return undefined;
    }

    const countries = await this.executeKw<OdooCountryRecord[]>(
      credentials,
      uid,
      'res.country',
      'search_read',
      [[['code', '=', normalizedCountryCode]]],
      {
        fields: ['id'],
        limit: 1,
      },
    );

    return countries[0]?.id;
  }

  private parseExternalId(externalId?: string): number | undefined {
    const normalizedExternalId = externalId?.trim();

    if (!normalizedExternalId) {
      return undefined;
    }

    const parsed = Number(normalizedExternalId);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(
        `Odoo external reference id must be a positive integer. Received ${normalizedExternalId}.`,
      );
    }

    return parsed;
  }

  private resolveCredentials(source: Record<string, unknown>): OdooCredentials {
    return {
      apiBaseUrl:
        this.readString(source, 'apiBaseUrl') ??
        this.configService.get('ODOO_API_BASE_URL', { infer: true }),
      database:
        this.readString(source, 'database') ??
        this.configService.get('ODOO_DATABASE', { infer: true }),
      username:
        this.readString(source, 'username') ??
        this.configService.get('ODOO_USERNAME', { infer: true }),
      password:
        this.readString(source, 'password') ??
        this.readString(source, 'apiKey') ??
        this.configService.get('ODOO_PASSWORD', { infer: true }) ??
        this.configService.get('ODOO_API_KEY', { infer: true }),
    };
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
