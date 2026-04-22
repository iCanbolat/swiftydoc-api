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

interface PlivoSendResponse {
  message_uuid?: string[];
  error?: string;
}

@Injectable()
export class PlivoSmsReminderProvider implements ReminderChannelProvider {
  readonly channel: ReminderChannel = REMINDER_CHANNELS.sms;
  readonly provider: ReminderProvider = REMINDER_PROVIDERS.plivo;

  constructor(
    private readonly configService: ConfigService<RuntimeEnv, true>,
  ) {}

  async send(
    payload: ReminderProviderSendPayload,
  ): Promise<ReminderDispatchResult> {
    const recipient = payload.recipient.trim();

    if (recipient.length === 0) {
      throw new BadRequestException('SMS reminder recipient is required.');
    }

    const messageBody = this.resolveMessageBody(payload);
    const providerConfig = payload.providerConfig;

    const authId =
      this.readString(providerConfig, 'authId') ??
      this.configService.get('PLIVO_AUTH_ID', { infer: true });
    const authToken =
      this.readString(providerConfig, 'authToken') ??
      this.configService.get('PLIVO_AUTH_TOKEN', { infer: true });
    const fromNumber =
      this.readString(providerConfig, 'fromNumber') ??
      this.configService.get('PLIVO_FROM_NUMBER', { infer: true });

    const canSendLive = !!authId && !!authToken && !!fromNumber;

    if (!canSendLive) {
      if (
        this.configService.get('NODE_ENV', { infer: true }) === 'production'
      ) {
        throw new ServiceUnavailableException(
          'Plivo credentials are missing for production SMS reminder delivery.',
        );
      }

      return this.simulateResult({
        reason: 'missing_credentials',
        recipient,
      });
    }

    const endpoint = `https://api.plivo.com/v1/Account/${authId}/Message/`;
    const encodedCredentials = Buffer.from(`${authId}:${authToken}`).toString(
      'base64',
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encodedCredentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        src: fromNumber,
        dst: recipient,
        text: messageBody,
      }),
    });

    const responseBody = (await response.json()) as PlivoSendResponse;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Plivo SMS request failed (${response.status}): ${responseBody.error ?? 'Unknown provider error'}`,
      );
    }

    const externalMessageId = responseBody.message_uuid?.[0];

    if (!externalMessageId) {
      throw new ServiceUnavailableException(
        'Plivo response did not include a message uuid.',
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
      externalMessageId: `sms_sim_${randomUUID()}`,
      acceptedAt: new Date().toISOString(),
      metadata: {
        mode: 'simulated',
        recipient: params.recipient,
        reason: params.reason,
      },
    };
  }
}
