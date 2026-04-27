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

interface ResendSendResponse {
  id?: string;
  error?: {
    message?: string;
  };
}

@Injectable()
export class ResendEmailReminderProvider implements ReminderChannelProvider {
  readonly channel: ReminderChannel = REMINDER_CHANNELS.email;
  readonly provider: ReminderProvider = REMINDER_PROVIDERS.resend;

  constructor(
    private readonly configService: ConfigService<RuntimeEnv, true>,
  ) {}

  async send(
    payload: ReminderProviderSendPayload,
  ): Promise<ReminderDispatchResult> {
    const recipient = payload.recipient.trim();

    if (recipient.length === 0) {
      throw new BadRequestException('Email reminder recipient is required.');
    }

    const providerConfig = payload.providerConfig;
    const apiKey =
      this.readString(providerConfig, 'apiKey') ??
      this.configService.get('RESEND_API_KEY', { infer: true });
    const fromEmail =
      this.readString(providerConfig, 'fromEmail') ??
      this.configService.get('RESEND_DEFAULT_FROM_EMAIL', { infer: true });

    const subject = this.resolveSubject(payload);
    const textBody = this.resolveBody(payload);
    const fromName =
      payload.branding?.emailFromName ?? payload.branding?.displayName ?? null;

    if (!apiKey || !fromEmail) {
      if (
        this.configService.get('NODE_ENV', { infer: true }) === 'production'
      ) {
        throw new ServiceUnavailableException(
          'Resend credentials are missing for production email reminder delivery.',
        );
      }

      return this.simulateResult({
        reason: 'missing_credentials',
        recipient,
        subject,
      });
    }

    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        text: textBody,
        reply_to: payload.branding?.emailReplyTo ?? undefined,
      }),
    });

    

    const responseBody = (await response.json()) as ResendSendResponse;
    console.log(`Resend API response status: ${response.status}, body: ${JSON.stringify(responseBody)}`); // Debug log

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Resend email request failed (${response.status}): ${responseBody.error?.message ?? 'Unknown provider error'}`,
      );
    }

    const externalMessageId = responseBody.id;

    if (!externalMessageId) {
      throw new ServiceUnavailableException(
        'Resend response did not include a message id.',
      );
    }

    return {
      provider: this.provider,
      channel: this.channel,
      externalMessageId,
      acceptedAt: new Date().toISOString(),
      metadata: {
        recipient,
        subject,
        templateKey: payload.templateKey ?? null,
      },
    };
  }

  private resolveSubject(payload: ReminderProviderSendPayload): string {
    if (payload.subject?.trim()) {
      return payload.subject.trim();
    }

    if (payload.templateVariant) {
      return this.renderTemplate(
        payload.templateVariant.subjectTemplate,
        payload.templateVariables,
      );
    }

    return `Reminder for request ${payload.requestId}`;
  }

  private resolveBody(payload: ReminderProviderSendPayload): string {
    if (payload.message?.trim()) {
      return payload.message.trim();
    }

    if (payload.templateVariant) {
      return this.renderTemplate(
        payload.templateVariant.bodyTemplate,
        payload.templateVariables,
      );
    }

    return `Please review and complete request ${payload.requestId}.`;
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
    subject: string;
  }): ReminderDispatchResult {
    return {
      provider: this.provider,
      channel: this.channel,
      externalMessageId: `email_sim_${randomUUID()}`,
      acceptedAt: new Date().toISOString(),
      metadata: {
        mode: 'simulated',
        recipient: params.recipient,
        subject: params.subject,
        reason: params.reason,
      },
    };
  }
}
