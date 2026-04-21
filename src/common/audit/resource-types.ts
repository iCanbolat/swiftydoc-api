type ValueOf<T> = T[keyof T];

export const RESOURCE_TYPES = {
  automation: {
    exportJob: 'export_job',
    integrationConnection: 'integration_connection',
    queueJob: 'queue_job',
    syncJob: 'sync_job',
    webhookDelivery: 'webhook_delivery',
    webhookEndpoint: 'webhook_endpoint',
    webhookEvent: 'webhook_event',
  },
  documents: {
    answer: 'answer',
    comment: 'comment',
    fileAsset: 'file_asset',
    request: 'request',
    reviewDecision: 'review_decision',
    submission: 'submission',
    template: 'template',
    templateField: 'template_field',
    templateSection: 'template_section',
  },
  identity: {
    auditEvent: 'audit_event',
    oauthApplication: 'oauth_application',
    oauthGrant: 'oauth_grant',
    organization: 'organization',
    permission: 'permission',
    role: 'role',
    user: 'user',
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
