import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'plivo';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import type {
  IntegrationConnectionTestResult,
  IntegrationConnector,
  IntegrationConnectorContext,
  IntegrationSyncResult,
} from './integration-connector.types';

interface PlivoCredentials {
  authId?: string;
  authToken?: string;
  fromNumber?: string;
}

interface PlivoAccountDetails {
  accountType?: string;
  apiId?: string;
  cashCredits?: string;
  city?: string;
  name?: string;
  resourceUri?: string;
}

@Injectable()
export class PlivoIntegrationConnector implements IntegrationConnector {
  readonly providerKey = 'plivo' as const;

  constructor(
    private readonly configService: ConfigService<RuntimeEnv, true>,
  ) {}

  async testConnection(
    context: IntegrationConnectorContext,
  ): Promise<IntegrationConnectionTestResult> {
    const credentials = this.resolveCredentials(context.settings);

    if (!credentials.authId || !credentials.authToken) {
      if (this.isProduction()) {
        throw new ServiceUnavailableException(
          'Plivo credentials are missing for production integration testing.',
        );
      }

      return {
        success: true,
        status: 'connected',
        mode: 'simulated',
        message: 'Simulated Plivo connection test succeeded.',
        metadata: {
          mode: 'simulated',
          reason: 'missing_credentials',
        },
      };
    }

    const client = new Client(credentials.authId, credentials.authToken);
    const account = (await client.accounts.get()) as PlivoAccountDetails;

    return {
      success: true,
      status: 'connected',
      mode: 'live',
      message: 'Plivo connection test succeeded.',
      metadata: {
        accountName: account.name ?? null,
        accountType: account.accountType ?? null,
        city: account.city ?? null,
        cashCredits: account.cashCredits ?? null,
        fromNumber: credentials.fromNumber ?? null,
      },
    };
  }

  async sync(context: IntegrationConnectorContext): Promise<IntegrationSyncResult> {
    const testResult = await this.testConnection(context);
    const credentials = this.resolveCredentials(context.settings);

    return {
      status: 'succeeded',
      mode: testResult.mode,
      message: 'Plivo metadata sync completed.',
      metadata: {
        ...testResult.metadata,
        fromNumber: credentials.fromNumber ?? null,
        syncScope: 'account_profile',
      },
    };
  }

  private resolveCredentials(source: Record<string, unknown>): PlivoCredentials {
    return {
      authId:
        this.readString(source, 'authId') ??
        this.configService.get('PLIVO_AUTH_ID', { infer: true }),
      authToken:
        this.readString(source, 'authToken') ??
        this.configService.get('PLIVO_AUTH_TOKEN', { infer: true }),
      fromNumber:
        this.readString(source, 'fromNumber') ??
        this.configService.get('PLIVO_FROM_NUMBER', { infer: true }),
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