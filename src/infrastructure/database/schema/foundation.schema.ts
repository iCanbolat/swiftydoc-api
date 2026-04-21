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
import type { ResourceType } from '../../../common/audit/resource-types';

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

export const auditCategoryEnum = pgEnum('audit_category', [
  'security',
  'data_access',
  'webhook',
  'queue',
  'system',
]);

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

export const auditEvents = pgTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    category: auditCategoryEnum('category').notNull(),
    action: varchar('action', { length: 120 }).$type<AuditAction>().notNull(),
    actorType: varchar('actor_type', { length: 64 }),
    actorId: text('actor_id'),
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
  ],
);
