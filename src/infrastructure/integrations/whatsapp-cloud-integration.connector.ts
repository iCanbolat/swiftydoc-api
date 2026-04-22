import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import { REMINDER_PROVIDERS } from '../../common/reminders/reminder-types';
import type {
  IntegrationConnectionTestResult,
  IntegrationConnector,
  IntegrationConnectorContext,
  IntegrationSyncResult,
} from './integration-connector.types';

interface WhatsAppPhoneNumberResponse {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  error?: {
    message?: string;
  };
}

@Injectable()
export class WhatsAppCloudIntegrationConnector implements IntegrationConnector {
  readonly providerKey = REMINDER_PROVIDERS.whatsappCloudApi;

  constructor(
    private readonly configService: ConfigService<RuntimeEnv, true>,
  ) {}

  async testConnection(
    context: IntegrationConnectorContext,
  ): Promise<IntegrationConnectionTestResult> {
    const credentials = this.resolveCredentials(context.settings);

    if (!credentials.accessToken || !credentials.phoneNumberId) {
      if (this.isProduction()) {
        throw new ServiceUnavailableException(
          'WhatsApp Cloud API credentials are missing for production integration testing.',
        );
      }

      return {
        success: true,
        status: 'connected',
        mode: 'simulated',
        message: 'Simulated WhatsApp Cloud API connection test succeeded.',
        metadata: {
          mode: 'simulated',
          reason: 'missing_credentials',
        },
      };
    }

    const endpoint = `${credentials.baseUrl.replace(/\/$/, '')}/${credentials.apiVersion}/${credentials.phoneNumberId}?fields=id,display_phone_number,verified_name`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const responseBody =
      (await response.json()) as WhatsAppPhoneNumberResponse;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `WhatsApp Cloud API connection test failed (${response.status}): ${responseBody.error?.message ?? 'Unknown provider error'}`,
      );
    }

    return {
      success: true,
      status: 'connected',
      mode: 'live',
      message: 'WhatsApp Cloud API connection test succeeded.',
      metadata: {
        phoneNumberId: responseBody.id ?? credentials.phoneNumberId,
        displayPhoneNumber: responseBody.display_phone_number ?? null,
        verifiedName: responseBody.verified_name ?? null,
      },
    };
  }

  async sync(context: IntegrationConnectorContext): Promise<IntegrationSyncResult> {
    const testResult = await this.testConnection(context);

    return {
      status: 'succeeded',
      mode: testResult.mode,
      message: 'WhatsApp Cloud API metadata sync completed.',
      metadata: {
        ...testResult.metadata,
        syncScope: 'phone_number_profile',
      },
    };
  }

  private resolveCredentials(source: Record<string, unknown>) {
    return {
      accessToken:
        this.readString(source, 'accessToken') ??
        this.configService.get('WHATSAPP_CLOUD_API_TOKEN', { infer: true }),
      phoneNumberId:
        this.readString(source, 'phoneNumberId') ??
        this.configService.get('WHATSAPP_CLOUD_API_PHONE_NUMBER_ID', {
          infer: true,
        }),
      apiVersion:
        this.readString(source, 'apiVersion') ??
        this.configService.get('WHATSAPP_CLOUD_API_VERSION', { infer: true }) ??
        'v23.0',
      baseUrl:
        this.readString(source, 'baseUrl') ??
        this.configService.get('WHATSAPP_CLOUD_API_BASE_URL', { infer: true }) ??
        'https://graph.facebook.com',
    };
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