export const INTEGRATION_PROVIDER_KEY_VALUES = [
  'whatsapp_cloud_api',
  'plivo',
  'resend',
  'zoho_books',
  'odoo',
  'google_drive',
  'onedrive_sharepoint',
] as const;

export type IntegrationProviderKey =
  (typeof INTEGRATION_PROVIDER_KEY_VALUES)[number];

export const INTEGRATION_CONNECTION_STATUS_VALUES = [
  'pending',
  'connected',
  'degraded',
  'paused',
  'revoked',
] as const;

export type IntegrationConnectionStatus =
  (typeof INTEGRATION_CONNECTION_STATUS_VALUES)[number];

export const INTEGRATION_AUTH_TYPE_VALUES = [
  'none',
  'api_key',
  'bearer_token',
  'basic_auth',
  'oauth2',
] as const;

export type IntegrationAuthType = (typeof INTEGRATION_AUTH_TYPE_VALUES)[number];

export const SYNC_JOB_TYPE_VALUES = [
  'manual_sync',
  'connection_test',
] as const;

export type SyncJobType = (typeof SYNC_JOB_TYPE_VALUES)[number];

export const SYNC_JOB_STATUS_VALUES = [
  'queued',
  'running',
  'succeeded',
  'partial_success',
  'failed',
  'cancelled',
] as const;

export type SyncJobStatus = (typeof SYNC_JOB_STATUS_VALUES)[number];