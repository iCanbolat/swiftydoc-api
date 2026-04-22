export const AUDIT_CHANNEL_VALUES = [
  'api',
  'portal',
  'email',
  'sms',
  'whatsapp',
  'webhook',
  'review_panel',
  'system',
] as const;

export type AuditChannel = (typeof AUDIT_CHANNEL_VALUES)[number];
