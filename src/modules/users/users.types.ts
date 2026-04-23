import type { InternalRoleName } from '../auth/internal-role.types';

export const MANAGED_USER_STATUS_VALUES = [
  'active',
  'invited',
  'disabled',
] as const;

export type ManagedUserStatus = (typeof MANAGED_USER_STATUS_VALUES)[number];

export const MANAGED_MEMBERSHIP_STATUS_VALUES = [
  'active',
  'invited',
  'revoked',
] as const;

export type ManagedMembershipStatus =
  (typeof MANAGED_MEMBERSHIP_STATUS_VALUES)[number];

export interface UserWorkspaceAssignmentInput {
  roleName: InternalRoleName;
  workspaceId: string;
}

export interface CreateManagedUserInput {
  actorRoleNames: string[];
  actorUserId?: string;
  email: string;
  fullName: string;
  locale?: string;
  organizationId: string;
  phone?: string;
  memberships: UserWorkspaceAssignmentInput[];
}

export interface UpdateManagedUserInput {
  actorRoleNames: string[];
  actorUserId?: string;
  fullName?: string;
  locale?: string;
  organizationId: string;
  phone?: string;
  status?: ManagedUserStatus;
  memberships?: UserWorkspaceAssignmentInput[];
}

export interface ManagedUserMembershipView {
  createdAt: string;
  membershipId: string;
  roleId: string;
  roleName: string;
  status: ManagedMembershipStatus;
  workspaceCode: string;
  workspaceId: string;
  workspaceName: string;
}

export interface ManagedUserView {
  createdAt: string;
  email: string;
  emailVerifiedAt: string | null;
  fullName: string;
  id: string;
  lastLoginAt: string | null;
  locale: string;
  memberships: ManagedUserMembershipView[];
  phone: string | null;
  status: ManagedUserStatus;
}
