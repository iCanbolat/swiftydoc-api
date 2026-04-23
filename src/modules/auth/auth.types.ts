import type { PortalLinkPurpose } from '../../common/portal/portal-link-types';

export interface AuthenticatedMembership {
  membershipId: string;
  roleId: string;
  roleName: string;
  status: string;
  workspaceCode: string;
  workspaceId: string;
  workspaceName: string;
}

export interface AuthenticatedOrganization {
  createdAt: string;
  defaultLocale: string;
  displayName: string;
  id: string;
  planTier: string;
  primaryRegion: string;
  slug: string;
  status: string;
  timezone: string;
}

export interface AuthenticatedSession {
  activeWorkspaceId: string;
  expiresAt: string;
  id: string;
}

export interface AuthenticatedUser {
  createdAt: string;
  email: string;
  emailVerifiedAt: string | null;
  fullName: string;
  id: string;
  lastLoginAt: string | null;
  locale: string;
  phone: string | null;
  status: string;
}

export interface AuthenticatedInternalActor {
  memberships: AuthenticatedMembership[];
  organization: AuthenticatedOrganization;
  roleNames: string[];
  session: AuthenticatedSession;
  user: AuthenticatedUser;
}

export interface AuthenticatedPortalActor {
  expiresAt: string;
  organizationId: string;
  portalLinkId: string;
  purpose: PortalLinkPurpose;
  recipientId: string | null;
  requestId: string;
  submissionId: string | null;
}

export interface InternalAuthRequest {
  body?: Record<string, unknown>;
  currentActor?: AuthenticatedInternalActor;
  currentPortalActor?: AuthenticatedPortalActor;
  headers: {
    authorization?: string | string[];
  };
  params?: Record<string, string | undefined>;
  query?: Record<string, string | string[] | undefined>;
  resolvedWorkspaceId?: string;
}
