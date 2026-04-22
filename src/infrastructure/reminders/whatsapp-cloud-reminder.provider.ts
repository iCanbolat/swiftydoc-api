import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  REMINDER_CHANNELS,
  REMINDER_PROVIDERS,
  type ReminderChannel,
  type ReminderProvider,
} from '../../common/reminders/reminder-types';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import type {
  ReminderChannelProvider,
  ReminderDispatchResult,
  ReminderProviderSendPayload,
} from './reminder-provider.types';

interface WhatsAppSendResponse {
  messages?: Array<{ id?: string }>;
  error?: {
    message?: string;
  };
}

@Injectable()
export class WhatsAppCloudReminderProvider implements ReminderChannelProvider {
  readonly channel: ReminderChannel = REMINDER_CHANNELS.whatsapp;
  readonly provider: ReminderProvider = REMINDER_PROVIDERS.whatsappCloudApi;

  constructor(
    private readonly configService: ConfigService<RuntimeEnv, true>,
  ) {}

  async send(
    payload: ReminderProviderSendPayload,
  ): Promise<ReminderDispatchResult> {
    const recipient = payload.recipient.trim();

    if (recipient.length === 0) {
      throw new BadRequestException(
        'Reminder recipient is required for WhatsApp channel.',
      );
    }

    const messageBody = this.resolveMessageBody(payload);
    const providerConfig = payload.providerConfig;

    const accessToken =
      this.readString(providerConfig, 'accessToken') ??
      this.configService.get('WHATSAPP_CLOUD_API_TOKEN', { infer: true });
    const phoneNumberId =
      this.readString(providerConfig, 'phoneNumberId') ??
      this.configService.get('WHATSAPP_CLOUD_API_PHONE_NUMBER_ID', {
        infer: true,
      });
    const apiVersion =
      this.readString(providerConfig, 'apiVersion') ??
      this.configService.get('WHATSAPP_CLOUD_API_VERSION', { infer: true }) ??
      'v23.0';
    const baseUrl =
      this.readString(providerConfig, 'baseUrl') ??
      this.configService.get('WHATSAPP_CLOUD_API_BASE_URL', { infer: true }) ??
      'https://graph.facebook.com';

    const canSendLive = !!accessToken && !!phoneNumberId;

    if (!canSendLive) {
      if (
        this.configService.get('NODE_ENV', { infer: true }) === 'production'
      ) {
        throw new ServiceUnavailableException(
          'WhatsApp Cloud API credentials are missing for production reminder delivery.',
        );
      }

      return this.simulateResult({
        reason: 'missing_credentials',
        recipient,
      });
    }

    const endpoint = `${baseUrl.replace(/\/$/, '')}/${apiVersion}/${phoneNumberId}/messages`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          body: messageBody,
        },
      }),
    });

    const responseBody = (await response.json()) as WhatsAppSendResponse;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `WhatsApp Cloud API request failed (${response.status}): ${responseBody.error?.message ?? 'Unknown provider error'}`,
      );
    }

    const externalMessageId = responseBody.messages?.[0]?.id;

    if (!externalMessageId) {
      throw new ServiceUnavailableException(
        'WhatsApp Cloud API response did not include a message id.',
      );
    }

    return {
      provider: this.provider,
      channel: this.channel,
      externalMessageId,
      acceptedAt: new Date().toISOString(),
      metadata: {
        recipient,
      },
    };
  }

  private resolveMessageBody(payload: ReminderProviderSendPayload): string {
    const message = payload.message?.trim();

    if (message && message.length > 0) {
      return message;
    }

    if (payload.templateVariant) {
      return this.renderTemplate(
        payload.templateVariant.bodyTemplate,
        payload.templateVariables,
      );
    }

    return `Reminder for request ${payload.requestId}`;
  }

  private renderTemplate(
    template: string,
    variables?: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const value = variables?.[key];
      return value === undefined || value === null ? '' : String(value);
    });
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

  private simulateResult(params: {
    reason: string;
    recipient: string;
  }): ReminderDispatchResult {
    return {
      provider: this.provider,
      channel: this.channel,
      externalMessageId: `wa_sim_${randomUUID()}`,
      acceptedAt: new Date().toISOString(),
      metadata: {
        mode: 'simulated',
        recipient: params.recipient,
        reason: params.reason,
      },
    };
  }
}
