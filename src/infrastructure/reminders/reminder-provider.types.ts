import type {
  ReminderChannel,
  ReminderProvider,
} from '../../common/reminders/reminder-types';

export interface ReminderDispatchInput {
  organizationId: string;
  requestId: string;
  channel: ReminderChannel;
  recipient: string;
  message?: string;
  subject?: string;
  templateKey?: string;
  templateVariables?: Record<string, unknown>;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export interface ReminderBrandingSettings {
  displayName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  emailFromName?: string | null;
  emailReplyTo?: string | null;
}

export interface ReminderEmailTemplateVariant {
  templateKey: string;
  locale: string;
  resendTemplateId?: string | null;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface ReminderProviderSendPayload extends ReminderDispatchInput {
  providerConfig: Record<string, unknown>;
  branding?: ReminderBrandingSettings;
  templateVariant?: ReminderEmailTemplateVariant;
}

export interface ReminderDispatchResult {
  provider: ReminderProvider;
  channel: ReminderChannel;
  externalMessageId: string;
  acceptedAt: string;
  metadata: Record<string, unknown>;
}

export interface ReminderChannelProvider {
  readonly channel: ReminderChannel;
  readonly provider: ReminderProvider;

  send(payload: ReminderProviderSendPayload): Promise<ReminderDispatchResult>;
}
