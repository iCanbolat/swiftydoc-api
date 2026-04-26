export interface GoogleOidcTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleOidcUserProfile {
  email?: string;
  email_verified?: boolean;
  name?: string;
  sub?: string;
}

export interface ResolvedGoogleOidcUserProfile {
  email: string;
  emailVerifiedAt: Date | null;
  fullName: string;
  subject: string;
}

export interface GoogleAuthStateTokenPayload {
  exp: string;
  iat: string;
  intent: 'link' | 'sign_in' | 'sign_up';
  inviteToken?: string;
  organizationId?: string;
  organizationName?: string;
  organizationSlug?: string;
  legalName?: string;
  locale?: string;
  primaryRegion?: string;
  sessionId?: string;
  type: 'google_state';
  timezone?: string;
  userEmail?: string;
  userId?: string;
  workspaceCode?: string;
  workspaceName?: string;
}

export interface GoogleLinkPendingTokenPayload {
  email: string;
  exp: string;
  googleEmail: string;
  googleEmailVerified: boolean;
  googleSubject: string;
  iat: string;
  organizationId: string;
  organizationSlug: string;
  type: 'google_link_pending';
  userId: string;
}
