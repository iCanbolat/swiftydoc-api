import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import type { AuditAction } from '../../../common/audit/audit-actions';
import {
  AUDIT_CHANNEL_VALUES,
  type AuditChannel,
} from '../../../common/audit/audit-channel';
import {
  INTEGRATION_AUTH_TYPE_VALUES,
  INTEGRATION_CONNECTION_STATUS_VALUES,
  INTEGRATION_PROVIDER_KEY_VALUES,
  SYNC_JOB_STATUS_VALUES,
  SYNC_JOB_TYPE_VALUES,
} from '../../../common/integrations/integration-types';
import type { ResourceType } from '../../../common/audit/resource-types';
import {
  REMINDER_CHANNEL_VALUES,
  REMINDER_PROVIDER_VALUES,
} from '../../../common/reminders/reminder-types';
import { WEBHOOK_DELIVERY_STATUS_VALUES } from '../../../common/webhooks/webhook-delivery-types';
import {
  AUDIT_AUTH_SURFACE_VALUES,
  type AuditAuthSurface,
} from '../../audit/audit.types';

export const organizationStatusEnum = pgEnum('organization_status', [
  'active',
  'suspended',
  'archived',
]);

export const workspaceStatusEnum = pgEnum('workspace_status', [
  'active',
  'disabled',
  'archived',
]);

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'invited',
  'disabled',
]);

export const membershipStatusEnum = pgEnum('membership_status', [
  'active',
  'invited',
  'revoked',
]);

export const oauthApplicationTypeEnum = pgEnum('oauth_application_type', [
  'confidential',
  'public',
]);

export const oauthApplicationStatusEnum = pgEnum('oauth_application_status', [
  'active',
  'paused',
  'revoked',
]);

export const oauthGrantTypeEnum = pgEnum('oauth_grant_type', [
  'authorization_code',
  'client_credentials',
  'refresh_token',
]);

export const oauthGrantStatusEnum = pgEnum('oauth_grant_status', [
  'active',
  'expired',
  'revoked',
]);

export const authIdentityProviderEnum = pgEnum('auth_identity_provider', [
  'password',
  'google_oidc',
  'microsoft_oidc',
  'saml',
]);

export const mfaFactorTypeEnum = pgEnum('mfa_factor_type', [
  'totp',
  'email_otp',
  'sms_otp',
  'webauthn',
]);

export const webhookDeliveryStatusEnum = pgEnum(
  'webhook_delivery_status',
  WEBHOOK_DELIVERY_STATUS_VALUES,
);

export const auditCategoryEnum = pgEnum('audit_category', [
  'security',
  'data_access',
  'webhook',
  'queue',
  'system',
]);

export const auditEventChannelEnum = pgEnum(
  'audit_event_channel',
  AUDIT_CHANNEL_VALUES,
);

export const auditAuthSurfaceEnum = pgEnum(
  'audit_auth_surface',
  AUDIT_AUTH_SURFACE_VALUES,
);

export const clientStatusEnum = pgEnum('client_status', ['active', 'archived']);

export const contactStatusEnum = pgEnum('contact_status', [
  'active',
  'inactive',
]);

export const recipientStatusEnum = pgEnum('recipient_status', [
  'active',
  'disabled',
]);

export const recipientDeliveryChannelEnum = pgEnum(
  'recipient_delivery_channel',
  ['email', 'whatsapp', 'sms'],
);

export const reminderChannelEnum = pgEnum(
  'reminder_channel',
  REMINDER_CHANNEL_VALUES,
);

export const reminderProviderEnum = pgEnum(
  'reminder_provider',
  REMINDER_PROVIDER_VALUES,
);

export const templateStatusEnum = pgEnum('template_status', [
  'draft',
  'published',
  'archived',
]);

export const templateVersionStatusEnum = pgEnum('template_version_status', [
  'draft',
  'published',
  'archived',
]);

export const templateFieldTypeEnum = pgEnum('template_field_type', [
  'text',
  'textarea',
  'number',
  'date',
  'single_select',
  'multi_select',
  'boolean',
  'file',
]);

export const requestStatusEnum = pgEnum('request_status', [
  'draft',
  'sent',
  'in_progress',
  'completed',
  'closed',
  'cancelled',
]);

export const submissionStatusEnum = pgEnum('submission_status', [
  'in_progress',
  'completed',
  'reopened',
]);

export const submissionItemStatusEnum = pgEnum('submission_item_status', [
  'pending',
  'provided',
  'approved',
  'rejected',
  'changes_requested',
]);

export const portalLinkPurposeEnum = pgEnum('portal_link_purpose', [
  'request_access',
  'submission_access',
]);

export const portalLinkStatusEnum = pgEnum('portal_link_status', [
  'active',
  'consumed',
  'revoked',
  'expired',
]);

export const reviewDecisionTypeEnum = pgEnum('review_decision_type', [
  'approved',
  'rejected',
]);

export const commentAuthorTypeEnum = pgEnum('comment_author_type', [
  'reviewer',
  'recipient',
  'system',
]);

export const exportJobTypeEnum = pgEnum('export_job_type', [
  'zip',
  'pdf_summary',
  'csv_metadata',
]);

export const exportJobStatusEnum = pgEnum('export_job_status', [
  'queued',
  'processing',
  'completed',
  'failed',
]);

export const integrationProviderKeyEnum = pgEnum(
  'integration_provider_key',
  INTEGRATION_PROVIDER_KEY_VALUES,
);

export const integrationAuthTypeEnum = pgEnum(
  'integration_auth_type',
  INTEGRATION_AUTH_TYPE_VALUES,
);

export const integrationConnectionStatusEnum = pgEnum(
  'integration_connection_status',
  INTEGRATION_CONNECTION_STATUS_VALUES,
);

export const syncJobTypeEnum = pgEnum('sync_job_type', SYNC_JOB_TYPE_VALUES);

export const syncJobStatusEnum = pgEnum(
  'sync_job_status',
  SYNC_JOB_STATUS_VALUES,
);

export const fileAssetStatusEnum = pgEnum('file_asset_status', [
  'active',
  'deleted',
]);

export const organizations = pgTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    slug: varchar('slug', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    legalName: varchar('legal_name', { length: 160 }),
    defaultLocale: varchar('default_locale', { length: 16 })
      .notNull()
      .default('en'),
    primaryRegion: varchar('primary_region', { length: 32 })
      .notNull()
      .default('mena'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
    planTier: varchar('plan_tier', { length: 32 })
      .notNull()
      .default('foundation'),
    dataResidencyPolicy: varchar('data_residency_policy', { length: 32 })
      .notNull()
      .default('standard'),
    status: organizationStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('organizations_slug_key').on(table.slug)],
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    defaultBrandingId: text('default_branding_id'),
    defaultReminderPolicyId: text('default_reminder_policy_id'),
    status: workspaceStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('workspaces_org_code_key').on(table.organizationId, table.code),
  ],
);

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    locale: varchar('locale', { length: 16 }).notNull().default('en'),
    phone: varchar('phone', { length: 32 }),
    status: userStatusEnum('status').notNull().default('invited'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('users_email_key').on(table.email)],
);

export const roles = pgTable(
  'roles',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    isSystemRole: boolean('is_system_role').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('roles_org_name_key').on(table.organizationId, table.name),
  ],
);

export const permissions = pgTable(
  'permissions',
  {
    id: text('id').primaryKey(),
    code: varchar('code', { length: 120 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('permissions_code_key').on(table.code)],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const workspaceMemberships = pgTable(
  'workspace_memberships',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    status: membershipStatusEnum('status').notNull().default('invited'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('workspace_memberships_workspace_user_key').on(
      table.workspaceId,
      table.userId,
    ),
  ],
);

export const oauthApplications = pgTable('oauth_applications', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  clientId: varchar('client_id', { length: 120 }).notNull(),
  clientSecretHash: text('client_secret_hash'),
  redirectUris: jsonb('redirect_uris')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  allowedScopes: jsonb('allowed_scopes')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  applicationType: oauthApplicationTypeEnum('application_type')
    .notNull()
    .default('confidential'),
  status: oauthApplicationStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const oauthGrants = pgTable('oauth_grants', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  applicationId: text('application_id')
    .notNull()
    .references(() => oauthApplications.id, { onDelete: 'cascade' }),
  grantedByUserId: text('granted_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  grantType: oauthGrantTypeEnum('grant_type').notNull(),
  scopes: jsonb('scopes')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  status: oauthGrantStatusEnum('status').notNull().default('active'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: authIdentityProviderEnum('provider').notNull(),
    providerSubject: varchar('provider_subject', { length: 255 }).notNull(),
    passwordHash: text('password_hash'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastAuthenticatedAt: timestamp('last_authenticated_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_identities_provider_subject_key').on(
      table.provider,
      table.providerSubject,
    ),
    uniqueIndex('auth_identities_user_provider_key').on(
      table.userId,
      table.provider,
    ),
  ],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    activeWorkspaceId: text('active_workspace_id').references(
      () => workspaces.id,
      { onDelete: 'set null' },
    ),
    accessTokenHash: text('access_token_hash').notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 500 }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('user_sessions_access_token_hash_key').on(
      table.accessTokenHash,
    ),
    index('user_sessions_user_org_idx').on(table.userId, table.organizationId),
    index('user_sessions_org_revoked_idx').on(
      table.organizationId,
      table.revokedAt,
    ),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => userSessions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    familyId: text('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedByTokenId: text('replaced_by_token_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('refresh_tokens_token_hash_key').on(table.tokenHash),
    index('refresh_tokens_session_idx').on(table.sessionId),
    index('refresh_tokens_user_revoked_idx').on(table.userId, table.revokedAt),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('password_reset_tokens_token_hash_key').on(table.tokenHash),
    index('password_reset_tokens_user_idx').on(table.userId),
  ],
);

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('email_verification_tokens_token_hash_key').on(table.tokenHash),
    index('email_verification_tokens_user_idx').on(table.userId),
  ],
);

export const mfaFactors = pgTable(
  'mfa_factors',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    factorType: mfaFactorTypeEnum('factor_type').notNull(),
    label: varchar('label', { length: 120 }),
    secretCiphertext: text('secret_ciphertext'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('mfa_factors_user_idx').on(table.userId),
    index('mfa_factors_org_idx').on(table.organizationId),
  ],
);

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 500 }).notNull(),
    secret: text('secret').notNull(),
    subscribedEvents: jsonb('subscribed_events')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('webhook_endpoints_org_enabled_idx').on(
      table.organizationId,
      table.enabled,
    ),
  ],
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    endpointId: text('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    eventId: varchar('event_id', { length: 120 }).notNull(),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    requestBody: jsonb('request_body')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: webhookDeliveryStatusEnum('status').notNull().default('queued'),
    attemptCount: integer('attempt_count').notNull().default(0),
    responseCode: integer('response_code'),
    lastErrorMessage: text('last_error_message'),
    sourceDeliveryId: text('source_delivery_id'),
    lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('webhook_deliveries_org_created_idx').on(
      table.organizationId,
      table.createdAt,
    ),
    index('webhook_deliveries_endpoint_status_idx').on(
      table.endpointId,
      table.status,
    ),
  ],
);

export const clients = pgTable(
  'clients',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    legalName: varchar('legal_name', { length: 160 }),
    externalRef: varchar('external_ref', { length: 120 }),
    status: clientStatusEnum('status').notNull().default('active'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    index('clients_org_workspace_idx').on(
      table.organizationId,
      table.workspaceId,
    ),
    uniqueIndex('clients_workspace_external_ref_key').on(
      table.workspaceId,
      table.externalRef,
    ),
  ],
);

export const clientContacts = pgTable(
  'client_contacts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    locale: varchar('locale', { length: 16 }).notNull().default('en'),
    status: contactStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('client_contacts_client_email_key').on(
      table.clientId,
      table.email,
    ),
  ],
);

export const recipients = pgTable(
  'recipients',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').references(() => clientContacts.id, {
      onDelete: 'set null',
    }),
    label: varchar('label', { length: 160 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    deliveryChannel: recipientDeliveryChannelEnum('delivery_channel')
      .notNull()
      .default('email'),
    status: recipientStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('recipients_client_email_key').on(table.clientId, table.email),
  ],
);

export const templates = pgTable(
  'templates',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    description: text('description'),
    status: templateStatusEnum('status').notNull().default('draft'),
    publishedVersionNumber: integer('published_version_number'),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('templates_workspace_slug_key').on(
      table.workspaceId,
      table.slug,
    ),
  ],
);

export const templateVersions = pgTable(
  'template_versions',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: templateVersionStatusEnum('status').notNull().default('draft'),
    changeSummary: text('change_summary'),
    schemaChecksum: varchar('schema_checksum', { length: 64 }),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('template_versions_template_version_key').on(
      table.templateId,
      table.versionNumber,
    ),
  ],
);

export const templateSections = pgTable(
  'template_sections',
  {
    id: text('id').primaryKey(),
    templateVersionId: text('template_version_id')
      .notNull()
      .references(() => templateVersions.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 160 }).notNull(),
    description: text('description'),
    position: integer('position').notNull(),
    isRepeatable: boolean('is_repeatable').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('template_sections_version_position_key').on(
      table.templateVersionId,
      table.position,
    ),
  ],
);

export const templateFields = pgTable(
  'template_fields',
  {
    id: text('id').primaryKey(),
    templateVersionId: text('template_version_id')
      .notNull()
      .references(() => templateVersions.id, { onDelete: 'cascade' }),
    sectionId: text('section_id')
      .notNull()
      .references(() => templateSections.id, { onDelete: 'cascade' }),
    fieldKey: varchar('field_key', { length: 120 }).notNull(),
    label: varchar('label', { length: 160 }).notNull(),
    helpText: text('help_text'),
    fieldType: templateFieldTypeEnum('field_type').notNull(),
    isRequired: boolean('is_required').notNull().default(false),
    position: integer('position').notNull(),
    options: jsonb('options')
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    validationRules: jsonb('validation_rules')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    conditionalRules: jsonb('conditional_rules')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('template_fields_section_position_key').on(
      table.sectionId,
      table.position,
    ),
    uniqueIndex('template_fields_version_field_key').on(
      table.templateVersionId,
      table.fieldKey,
    ),
  ],
);

export const requests = pgTable(
  'requests',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
    templateVersionId: text('template_version_id')
      .notNull()
      .references(() => templateVersions.id, { onDelete: 'restrict' }),
    requestCode: varchar('request_code', { length: 64 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    message: text('message'),
    status: requestStatusEnum('status').notNull().default('draft'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    overdueNotifiedAt: timestamp('overdue_notified_at', {
      withTimezone: true,
    }),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('requests_org_code_key').on(
      table.organizationId,
      table.requestCode,
    ),
    index('requests_workspace_status_idx').on(table.workspaceId, table.status),
  ],
);

export const submissions = pgTable(
  'submissions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requestId: text('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => recipients.id, { onDelete: 'restrict' }),
    status: submissionStatusEnum('status').notNull().default('in_progress'),
    progressPercent: integer('progress_percent').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('submissions_request_recipient_key').on(
      table.requestId,
      table.recipientId,
    ),
    index('submissions_request_status_idx').on(table.requestId, table.status),
  ],
);

export const portalLinks = pgTable(
  'portal_links',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requestId: text('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    submissionId: text('submission_id').references(() => submissions.id, {
      onDelete: 'set null',
    }),
    recipientId: text('recipient_id').references(() => recipients.id, {
      onDelete: 'set null',
    }),
    purpose: portalLinkPurposeEnum('purpose')
      .notNull()
      .default('request_access'),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    status: portalLinkStatusEnum('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    maxUses: integer('max_uses').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('portal_links_token_hash_key').on(table.tokenHash),
    index('portal_links_request_status_idx').on(table.requestId, table.status),
    index('portal_links_submission_idx').on(table.submissionId),
  ],
);

export const submissionItems = pgTable(
  'submission_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    submissionId: text('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    templateFieldId: text('template_field_id')
      .notNull()
      .references(() => templateFields.id, { onDelete: 'restrict' }),
    status: submissionItemStatusEnum('status').notNull().default('pending'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('submission_items_submission_field_key').on(
      table.submissionId,
      table.templateFieldId,
    ),
  ],
);

export const answers = pgTable(
  'answers',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    submissionItemId: text('submission_item_id')
      .notNull()
      .references(() => submissionItems.id, { onDelete: 'cascade' }),
    value: jsonb('value')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    answeredByType: varchar('answered_by_type', { length: 32 })
      .notNull()
      .default('recipient'),
    answeredById: text('answered_by_id'),
    source: varchar('source', { length: 32 }).notNull().default('portal'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('answers_submission_item_key').on(table.submissionItemId),
  ],
);

export const reviewDecisions = pgTable(
  'review_decisions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requestId: text('request_id').references(() => requests.id, {
      onDelete: 'set null',
    }),
    submissionId: text('submission_id').references(() => submissions.id, {
      onDelete: 'set null',
    }),
    submissionItemId: text('submission_item_id')
      .notNull()
      .references(() => submissionItems.id, { onDelete: 'cascade' }),
    decision: reviewDecisionTypeEnum('decision').notNull(),
    reviewerId: text('reviewer_id'),
    note: text('note'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('review_decisions_item_created_idx').on(
      table.submissionItemId,
      table.createdAt,
    ),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requestId: text('request_id').references(() => requests.id, {
      onDelete: 'set null',
    }),
    submissionId: text('submission_id').references(() => submissions.id, {
      onDelete: 'set null',
    }),
    submissionItemId: text('submission_item_id')
      .notNull()
      .references(() => submissionItems.id, { onDelete: 'cascade' }),
    authorType: commentAuthorTypeEnum('author_type')
      .notNull()
      .default('reviewer'),
    authorId: text('author_id'),
    body: text('body').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('comments_item_created_idx').on(
      table.submissionItemId,
      table.createdAt,
    ),
  ],
);

export const exportJobs = pgTable(
  'export_jobs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requestId: text('request_id').references(() => requests.id, {
      onDelete: 'set null',
    }),
    submissionId: text('submission_id').references(() => submissions.id, {
      onDelete: 'set null',
    }),
    type: exportJobTypeEnum('type').notNull(),
    status: exportJobStatusEnum('status').notNull().default('queued'),
    artifactStorageKey: varchar('artifact_storage_key', { length: 320 }),
    artifactMimeType: varchar('artifact_mime_type', { length: 255 }),
    artifactSizeBytes: integer('artifact_size_bytes'),
    requestedByUserId: text('requested_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('export_jobs_org_created_idx').on(
      table.organizationId,
      table.createdAt,
    ),
    index('export_jobs_request_status_idx').on(table.requestId, table.status),
  ],
);

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    providerKey: integrationProviderKeyEnum('provider_key').notNull(),
    authType: integrationAuthTypeEnum('auth_type').notNull(),
    credentialsRef: varchar('credentials_ref', { length: 255 }),
    settings: jsonb('settings')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: integrationConnectionStatusEnum('status')
      .notNull()
      .default('pending'),
    errorMessage: text('error_message'),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('integration_connections_org_provider_idx').on(
      table.organizationId,
      table.providerKey,
    ),
    index('integration_connections_workspace_idx').on(table.workspaceId),
  ],
);

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    connectionId: text('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    jobType: syncJobTypeEnum('job_type').notNull(),
    targetResourceType: varchar('target_resource_type', { length: 120 }),
    targetResourceId: text('target_resource_id'),
    status: syncJobStatusEnum('status').notNull().default('queued'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastErrorCode: varchar('last_error_code', { length: 120 }),
    lastErrorMessage: text('last_error_message'),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    result: jsonb('result')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    queuedAt: timestamp('queued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    index('sync_jobs_org_status_idx').on(table.organizationId, table.status),
    index('sync_jobs_connection_queued_idx').on(
      table.connectionId,
      table.queuedAt,
    ),
  ],
);

export const integrationExternalReferences = pgTable(
  'integration_external_references',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    connectionId: text('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    providerKey: integrationProviderKeyEnum('provider_key').notNull(),
    localResourceType: varchar('local_resource_type', {
      length: 120,
    }).notNull(),
    localResourceId: text('local_resource_id').notNull(),
    externalObjectType: varchar('external_object_type', {
      length: 120,
    }).notNull(),
    externalId: text('external_id').notNull(),
    externalReferenceKey: varchar('external_reference_key', { length: 120 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('integration_external_refs_connection_local_obj_key').on(
      table.connectionId,
      table.localResourceType,
      table.localResourceId,
      table.externalObjectType,
    ),
    uniqueIndex('integration_external_refs_connection_external_obj_key').on(
      table.connectionId,
      table.externalObjectType,
      table.externalId,
    ),
    index('integration_external_refs_org_provider_idx').on(
      table.organizationId,
      table.providerKey,
    ),
  ],
);

export const organizationReminderProviderConfigs = pgTable(
  'organization_reminder_provider_configs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    channel: reminderChannelEnum('channel').notNull(),
    provider: reminderProviderEnum('provider').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    config: jsonb('config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('org_reminder_provider_configs_org_channel_key').on(
      table.organizationId,
      table.channel,
    ),
    index('org_reminder_provider_configs_org_enabled_idx').on(
      table.organizationId,
      table.enabled,
    ),
  ],
);

export const organizationBrandingSettings = pgTable(
  'organization_branding_settings',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    logoUrl: varchar('logo_url', { length: 512 }),
    primaryColor: varchar('primary_color', { length: 16 }),
    secondaryColor: varchar('secondary_color', { length: 16 }),
    emailFromName: varchar('email_from_name', { length: 160 }),
    emailReplyTo: varchar('email_reply_to', { length: 255 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('organization_branding_settings_org_key').on(
      table.organizationId,
    ),
  ],
);

export const organizationEmailTemplateVariants = pgTable(
  'organization_email_template_variants',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    templateKey: varchar('template_key', { length: 120 }).notNull(),
    locale: varchar('locale', { length: 16 }).notNull().default('en'),
    provider: reminderProviderEnum('provider').notNull().default('resend'),
    brandingSettingId: text('branding_setting_id').references(
      () => organizationBrandingSettings.id,
      { onDelete: 'set null' },
    ),
    resendTemplateId: varchar('resend_template_id', { length: 120 }),
    subjectTemplate: text('subject_template').notNull(),
    bodyTemplate: text('body_template').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('org_email_tpl_variants_org_key_locale_key').on(
      table.organizationId,
      table.templateKey,
      table.locale,
    ),
    index('org_email_tpl_variants_org_template_idx').on(
      table.organizationId,
      table.templateKey,
    ),
  ],
);

export const fileAssets = pgTable(
  'file_assets',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    requestId: text('request_id').references(() => requests.id, {
      onDelete: 'set null',
    }),
    submissionId: text('submission_id').references(() => submissions.id, {
      onDelete: 'set null',
    }),
    submissionItemId: text('submission_item_id').references(
      () => submissionItems.id,
      {
        onDelete: 'set null',
      },
    ),
    storageKey: varchar('storage_key', { length: 320 }).notNull(),
    storageDriver: varchar('storage_driver', { length: 16 }).notNull(),
    originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
    normalizedFileName: varchar('normalized_file_name', {
      length: 255,
    }).notNull(),
    extension: varchar('extension', { length: 16 }),
    declaredMimeType: varchar('declared_mime_type', { length: 255 }),
    detectedMimeType: varchar('detected_mime_type', { length: 255 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksumSha256: varchar('checksum_sha256', { length: 64 }).notNull(),
    status: fileAssetStatusEnum('status').notNull().default('active'),
    uploadedByType: varchar('uploaded_by_type', { length: 32 })
      .notNull()
      .default('unknown'),
    uploadedById: text('uploaded_by_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('file_assets_storage_key_key').on(table.storageKey),
    index('file_assets_org_created_idx').on(
      table.organizationId,
      table.createdAt,
    ),
    index('file_assets_submission_item_idx').on(table.submissionItemId),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    category: auditCategoryEnum('category').notNull(),
    channel: auditEventChannelEnum('channel').$type<AuditChannel>(),
    action: varchar('action', { length: 120 }).$type<AuditAction>().notNull(),
    authSurface: auditAuthSurfaceEnum('auth_surface')
      .$type<AuditAuthSurface>()
      .notNull()
      .default('system'),
    actorType: varchar('actor_type', { length: 64 }),
    actorId: text('actor_id'),
    sessionId: text('session_id'),
    activeWorkspaceId: text('active_workspace_id'),
    impersonatorActorId: text('impersonator_actor_id'),
    impersonatorSessionId: text('impersonator_session_id'),
    resourceType: varchar('resource_type', {
      length: 64,
    }).$type<ResourceType>(),
    resourceId: text('resource_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('audit_events_category_created_at_idx').on(
      table.category,
      table.createdAt,
    ),
    index('audit_events_auth_surface_created_at_idx').on(
      table.authSurface,
      table.createdAt,
    ),
    index('audit_events_session_created_at_idx').on(
      table.sessionId,
      table.createdAt,
    ),
    index('audit_events_workspace_created_at_idx').on(
      table.activeWorkspaceId,
      table.createdAt,
    ),
  ],
);
