export const OAUTH_APPLICATION_TYPE_VALUES = [
  'confidential',
  'public',
] as const;

export const OAUTH_APPLICATION_STATUS_VALUES = [
  'active',
  'paused',
  'revoked',
] as const;

export type OAuthApplicationType =
  (typeof OAUTH_APPLICATION_TYPE_VALUES)[number];

export type OAuthApplicationStatus =
  (typeof OAUTH_APPLICATION_STATUS_VALUES)[number];

export interface OAuthApplicationRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  clientId: string;
  redirectUris: string[];
  allowedScopes: string[];
  applicationType: OAuthApplicationType;
  status: OAuthApplicationStatus;
  clientSecretHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOAuthApplicationInput {
  organizationId: string;
  actorUserId: string;
  name: string;
  description?: string;
  redirectUris?: string[];
  allowedScopes?: string[];
  applicationType?: OAuthApplicationType;
}

export interface UpdateOAuthApplicationInput {
  organizationId: string;
  actorUserId: string;
  name?: string;
  description?: string;
  redirectUris?: string[];
  allowedScopes?: string[];
  applicationType?: OAuthApplicationType;
  status?: OAuthApplicationStatus;
}

export interface RotateOAuthApplicationSecretInput {
  organizationId: string;
  actorUserId: string;
}

export interface OAuthApplicationCredentialResult {
  application: OAuthApplicationRecord;
  clientSecret: string | null;
}
