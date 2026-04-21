import { sql } from 'drizzle-orm';
import {
  boolean,
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
