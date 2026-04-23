type ValueOf<T> = T[keyof T];

export const RESOURCE_TYPES = {
  automation: {
    exportJob: 'export_job',
    integrationConnection: 'integration_connection',
    queueJob: 'queue_job',
    reminderDispatch: 'reminder_dispatch',
    reminderProviderConfig: 'reminder_provider_config',
    syncJob: 'sync_job',
    webhookDelivery: 'webhook_delivery',
    webhookEndpoint: 'webhook_endpoint',
    webhookEvent: 'webhook_event',
  },
  documents: {
    answer: 'answer',
    client: 'client',
    comment: 'comment',
    fileAsset: 'file_asset',
    portalLink: 'portal_link',
    request: 'request',
    reviewDecision: 'review_decision',
    submissionItem: 'submission_item',
    submission: 'submission',
    template: 'template',
    templateField: 'template_field',
    templateSection: 'template_section',
  },
  identity: {
    auditEvent: 'audit_event',
    authIdentity: 'auth_identity',
    brandingSettings: 'branding_settings',
    emailTemplateVariant: 'email_template_variant',
    mfaFactor: 'mfa_factor',
    oauthApplication: 'oauth_application',
    oauthGrant: 'oauth_grant',
    organization: 'organization',
    permission: 'permission',
    refreshToken: 'refresh_token',
    role: 'role',
    user: 'user',
    userSession: 'user_session',
    workspace: 'workspace',
  },
} as const;

type ResourceTypeMap = typeof RESOURCE_TYPES;

export type ResourceType = {
  [Group in keyof ResourceTypeMap]: ValueOf<ResourceTypeMap[Group]>;
}[keyof ResourceTypeMap];

export const RESOURCE_TYPE_VALUES = Object.values(RESOURCE_TYPES).flatMap(
  (group) => Object.values(group),
) as ResourceType[];
