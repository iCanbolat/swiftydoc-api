export const REMINDER_CHANNEL_VALUES = ['email', 'sms', 'whatsapp'] as const;

export type ReminderChannel = (typeof REMINDER_CHANNEL_VALUES)[number];

export const REMINDER_CHANNELS = {
  email: 'email',
  sms: 'sms',
  whatsapp: 'whatsapp',
} as const;

export const REMINDER_PROVIDER_VALUES = [
  'plivo',
  'resend',
  'whatsapp_cloud_api',
] as const;

export type ReminderProvider = (typeof REMINDER_PROVIDER_VALUES)[number];

export const REMINDER_PROVIDERS = {
  plivo: 'plivo',
  resend: 'resend',
  whatsappCloudApi: 'whatsapp_cloud_api',
} as const;

export const DEFAULT_REMINDER_PROVIDER_BY_CHANNEL: Record<
  ReminderChannel,
  ReminderProvider
> = {
  email: REMINDER_PROVIDERS.resend,
  sms: REMINDER_PROVIDERS.plivo,
  whatsapp: REMINDER_PROVIDERS.whatsappCloudApi,
};
