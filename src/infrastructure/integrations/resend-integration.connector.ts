import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import type {
  IntegrationConnectionTestResult,
  IntegrationConnector,
  IntegrationConnectorContext,
  IntegrationSyncResult,
} from './integration-connector.types';

interface ResendDomainSummary {
  id?: string;
  name?: string;
  status?: string;
}

interface ResendListDomainsSuccess {
  data?: ResendDomainSummary[];
  has_more?: boolean;
  object?: 'list';
}

interface ResendListDomainsResponse {
  data: ResendListDomainsSuccess | null;
  error: {
    message: string;
  } | null;
}

@Injectable()
export class ResendIntegrationConnector implements IntegrationConnector {
  readonly providerKey = 'resend' as const;

  constructor(
    private readonly configService: ConfigService<RuntimeEnv, true>,
  ) {}

  async testConnection(
    context: IntegrationConnectorContext,
  ): Promise<IntegrationConnectionTestResult> {
    const credentials = this.resolveCredentials(context.settings);

    if (!credentials.apiKey) {
      if (this.isProduction()) {
        throw new ServiceUnavailableException(
          'Resend API key is missing for production integration testing.',
        );
      }

      return {
        success: true,
        status: 'connected',
        mode: 'simulated',
        message: 'Simulated Resend connection test succeeded.',
        metadata: {
          mode: 'simulated',
          reason: 'missing_credentials',
        },
      };
    }

    const resend = new Resend(credentials.apiKey);
    const response = (await resend.domains.list({
      limit: 1,
    })) as ResendListDomainsResponse;

    if (response.error) {
      throw new ServiceUnavailableException(
        `Resend connection test failed: ${response.error.message}`,
      );
    }

    const primaryDomain = response.data?.data?.[0];

    return {
      success: true,
      status: 'connected',
      mode: 'live',
      message: 'Resend connection test succeeded.',
      metadata: {
        defaultFromEmail: credentials.defaultFromEmail ?? null,
        domainCount: response.data?.data?.length ?? 0,
        primaryDomainId: primaryDomain?.id ?? null,
        primaryDomainName: primaryDomain?.name ?? null,
        primaryDomainStatus: primaryDomain?.status ?? null,
      },
    };
  }

  async sync(context: IntegrationConnectorContext): Promise<IntegrationSyncResult> {
    const testResult = await this.testConnection(context);

    return {
      status: 'succeeded',
      mode: testResult.mode,
      message: 'Resend metadata sync completed.',
      metadata: {
        ...testResult.metadata,
        syncScope: 'domain_profile',
      },
    };
  }

  private resolveCredentials(source: Record<string, unknown>) {
    return {
      apiKey:
        this.readString(source, 'apiKey') ??
        this.configService.get('RESEND_API_KEY', { infer: true }),
      defaultFromEmail:
        this.readString(source, 'defaultFromEmail') ??
        this.configService.get('RESEND_DEFAULT_FROM_EMAIL', { infer: true }),
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