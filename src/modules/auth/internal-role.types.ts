export const INTERNAL_ROLE_NAMES = [
  'organization_owner',
  'organization_admin',
  'workspace_manager',
  'workspace_operator',
  'workspace_reviewer',
  'auditor_readonly',
] as const;

export type InternalRoleName = (typeof INTERNAL_ROLE_NAMES)[number];
