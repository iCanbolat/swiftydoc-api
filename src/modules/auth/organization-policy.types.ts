import type { InternalRoleName } from './internal-role.types';

export const ORGANIZATION_PERMISSION_VALUES = [
  'organization.settings.read',
  'organization.settings.write',
  'integrations.read',
  'integrations.write',
  'webhooks.read',
  'webhooks.write',
  'oauth_applications.read',
  'oauth_applications.write',
  'billing.read',
  'billing.write',
  'users.read',
  'users.write',
  'workspaces.read',
  'workspaces.write',
  'audit.read',
  'workspace.requests.read',
  'workspace.requests.write',
  'workspace.templates.read',
  'workspace.templates.write',
  'workspace.clients.read',
  'workspace.clients.write',
  'workspace.files.read',
  'workspace.files.write',
  'workspace.reviews.read',
  'workspace.reviews.write',
  'workspace.exports.read',
  'workspace.exports.write',
] as const;

export type OrganizationPermission =
  (typeof ORGANIZATION_PERMISSION_VALUES)[number];

export const VERIFIED_EMAIL_REQUIRED_ORGANIZATION_PERMISSIONS = [
  'organization.settings.write',
  'integrations.write',
  'webhooks.write',
  'oauth_applications.write',
  'billing.write',
  'users.write',
  'workspaces.write',
] as const satisfies readonly OrganizationPermission[];

const VERIFIED_EMAIL_REQUIRED_PERMISSION_SET = new Set<OrganizationPermission>(
  VERIFIED_EMAIL_REQUIRED_ORGANIZATION_PERMISSIONS,
);

const WORKSPACE_MANAGER_PERMISSIONS = [
  'workspace.requests.read',
  'workspace.requests.write',
  'workspace.templates.read',
  'workspace.templates.write',
  'workspace.clients.read',
  'workspace.clients.write',
  'workspace.files.read',
  'workspace.files.write',
  'workspace.reviews.read',
  'workspace.reviews.write',
  'workspace.exports.read',
  'workspace.exports.write',
] as const satisfies readonly OrganizationPermission[];

const WORKSPACE_OPERATOR_PERMISSIONS = [
  'workspace.requests.read',
  'workspace.requests.write',
  'workspace.templates.read',
  'workspace.clients.read',
  'workspace.files.read',
  'workspace.files.write',
  'workspace.exports.read',
  'workspace.exports.write',
] as const satisfies readonly OrganizationPermission[];

const WORKSPACE_REVIEWER_PERMISSIONS = [
  'workspace.requests.read',
  'workspace.files.read',
  'workspace.reviews.read',
  'workspace.reviews.write',
] as const satisfies readonly OrganizationPermission[];

const AUDITOR_PERMISSIONS = [
  'audit.read',
  'webhooks.read',
  'workspace.requests.read',
  'workspace.files.read',
  'workspace.reviews.read',
  'workspace.exports.read',
] as const satisfies readonly OrganizationPermission[];

export const INTERNAL_ROLE_PERMISSION_MATRIX: Record<
  InternalRoleName,
  readonly OrganizationPermission[]
> = {
  organization_owner: ORGANIZATION_PERMISSION_VALUES,
  organization_admin: [
    'organization.settings.read',
    'organization.settings.write',
    'integrations.read',
    'integrations.write',
    'webhooks.read',
    'webhooks.write',
    'users.read',
    'users.write',
    'workspaces.read',
    'workspaces.write',
    'audit.read',
  ],
  workspace_manager: WORKSPACE_MANAGER_PERMISSIONS,
  workspace_operator: WORKSPACE_OPERATOR_PERMISSIONS,
  workspace_reviewer: WORKSPACE_REVIEWER_PERMISSIONS,
  auditor_readonly: AUDITOR_PERMISSIONS,
};

export function resolveOrganizationPermissions(
  roleNames: string[],
): Set<OrganizationPermission> {
  const permissions = new Set<OrganizationPermission>();

  for (const roleName of roleNames) {
    const rolePermissions =
      INTERNAL_ROLE_PERMISSION_MATRIX[
        roleName as keyof typeof INTERNAL_ROLE_PERMISSION_MATRIX
      ];

    if (!rolePermissions) {
      continue;
    }

    for (const permission of rolePermissions) {
      permissions.add(permission);
    }
  }

  return permissions;
}

export function requiresVerifiedEmailForOrganizationPermissions(
  permissions: readonly OrganizationPermission[],
): boolean {
  return permissions.some((permission) =>
    VERIFIED_EMAIL_REQUIRED_PERMISSION_SET.has(permission),
  );
}
