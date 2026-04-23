import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedUserDto {
  @ApiProperty({ example: 'user_123' })
  id!: string;

  @ApiProperty({ example: 'owner@acme.test' })
  email!: string;

  @ApiProperty({ example: '2026-04-23T10:00:00.000Z', nullable: true })
  emailVerifiedAt!: string | null;

  @ApiProperty({ example: 'Aylin Demir' })
  fullName!: string;

  @ApiProperty({ example: 'tr' })
  locale!: string;

  @ApiProperty({ example: '+905551112233', nullable: true })
  phone!: string | null;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty({ example: '2026-04-22T16:00:00.000Z', nullable: true })
  lastLoginAt!: string | null;

  @ApiProperty({ example: '2026-04-22T16:00:00.000Z' })
  createdAt!: string;
}

export class AuthenticatedOrganizationDto {
  @ApiProperty({ example: 'org_123' })
  id!: string;

  @ApiProperty({ example: 'acme-advisory' })
  slug!: string;

  @ApiProperty({ example: 'Acme Advisory' })
  displayName!: string;

  @ApiProperty({ example: 'tr' })
  defaultLocale!: string;

  @ApiProperty({ example: 'mena' })
  primaryRegion!: string;

  @ApiProperty({ example: 'Europe/Istanbul' })
  timezone!: string;

  @ApiProperty({ example: 'foundation' })
  planTier!: string;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty({ example: '2026-04-22T16:00:00.000Z' })
  createdAt!: string;
}

export class AuthenticatedMembershipDto {
  @ApiProperty({ example: 'membership_123' })
  membershipId!: string;

  @ApiProperty({ example: 'workspace_123' })
  workspaceId!: string;

  @ApiProperty({ example: 'Client Delivery' })
  workspaceName!: string;

  @ApiProperty({ example: 'client-delivery' })
  workspaceCode!: string;

  @ApiProperty({ example: 'role_123' })
  roleId!: string;

  @ApiProperty({ example: 'organization_owner' })
  roleName!: string;

  @ApiProperty({ example: 'active' })
  status!: string;
}

export class AuthenticatedSessionDto {
  @ApiProperty({ example: 'session_123' })
  id!: string;

  @ApiProperty({ example: 'workspace_123' })
  activeWorkspaceId!: string;

  @ApiProperty({ example: '2026-04-22T17:00:00.000Z' })
  expiresAt!: string;
}

export class AuthTokensDto {
  @ApiProperty({ example: 'swd_at_0123456789abcdef0123456789abcdef' })
  accessToken!: string;

  @ApiProperty({ example: 'swd_rt_0123456789abcdef0123456789abcdef' })
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: '2026-04-22T17:00:00.000Z' })
  expiresAt!: string;
}

export class AuthenticatedActorDto {
  @ApiProperty({ type: () => AuthenticatedUserDto })
  user!: AuthenticatedUserDto;

  @ApiProperty({ type: () => AuthenticatedOrganizationDto })
  organization!: AuthenticatedOrganizationDto;

  @ApiProperty({ type: () => AuthenticatedMembershipDto, isArray: true })
  memberships!: AuthenticatedMembershipDto[];

  @ApiProperty({ type: String, isArray: true, example: ['organization_owner'] })
  roleNames!: string[];

  @ApiProperty({ type: () => AuthenticatedSessionDto })
  session!: AuthenticatedSessionDto;
}

export class AuthSessionResponseDataDto {
  @ApiProperty({ type: () => AuthenticatedActorDto })
  actor!: AuthenticatedActorDto;

  @ApiProperty({ type: () => AuthTokensDto })
  tokens!: AuthTokensDto;
}

export class AuthSessionResponseDto {
  @ApiProperty({ type: () => AuthSessionResponseDataDto })
  data!: AuthSessionResponseDataDto;
}

export class CurrentActorResponseDataDto {
  @ApiProperty({ type: () => AuthenticatedActorDto })
  actor!: AuthenticatedActorDto;
}

export class CurrentActorResponseDto {
  @ApiProperty({ type: () => CurrentActorResponseDataDto })
  data!: CurrentActorResponseDataDto;
}

export class OrganizationEntitlementLimitsDto {
  @ApiProperty({ example: 250, nullable: true })
  activeRequests!: number | null;

  @ApiProperty({ example: 1000, nullable: true })
  emailPerMonth!: number | null;

  @ApiProperty({ example: 5, nullable: true })
  internalUsers!: number | null;

  @ApiProperty({ example: 250, nullable: true })
  smsPerMonth!: number | null;

  @ApiProperty({ example: 5368709120, nullable: true })
  storageBytes!: number | null;
}

export class OrganizationEntitlementUsageDto {
  @ApiProperty({ example: 12 })
  activeRequests!: number;

  @ApiProperty({ example: 214 })
  emailPerMonth!: number;

  @ApiProperty({ example: 3 })
  internalUsers!: number;

  @ApiProperty({ example: 18 })
  smsPerMonth!: number;

  @ApiProperty({ example: 12451840 })
  storageBytes!: number;
}

export class OrganizationEntitlementSnapshotDto {
  @ApiProperty({ example: '2026-04-23T10:00:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ type: () => OrganizationEntitlementLimitsDto })
  limits!: OrganizationEntitlementLimitsDto;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiProperty({ example: 'foundation' })
  planTier!: string;

  @ApiProperty({ type: () => OrganizationEntitlementUsageDto })
  usage!: OrganizationEntitlementUsageDto;
}

export class OrganizationEntitlementsResponseDto {
  @ApiProperty({ type: () => OrganizationEntitlementSnapshotDto })
  data!: OrganizationEntitlementSnapshotDto;
}

export class InvitePreviewOrganizationDto {
  @ApiProperty({ example: 'org_123' })
  id!: string;

  @ApiProperty({ example: 'Acme Advisory' })
  displayName!: string;

  @ApiProperty({ example: 'acme-advisory' })
  slug!: string;
}

export class InvitePreviewMembershipDto {
  @ApiProperty({ example: 'workspace_123' })
  workspaceId!: string;

  @ApiProperty({ example: 'Client Delivery' })
  workspaceName!: string;

  @ApiProperty({ example: 'client-delivery' })
  workspaceCode!: string;

  @ApiProperty({ example: 'workspace_manager' })
  roleName!: string;
}

export class InvitePreviewDataDto {
  @ApiProperty({ example: 'user_123' })
  userId!: string;

  @ApiProperty({ example: 'operator@acme.test' })
  email!: string;

  @ApiProperty({ example: 'Aylin Demir' })
  fullName!: string;

  @ApiProperty({ example: '2026-04-26T10:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ type: () => InvitePreviewOrganizationDto })
  organization!: InvitePreviewOrganizationDto;

  @ApiProperty({ type: () => InvitePreviewMembershipDto, isArray: true })
  memberships!: InvitePreviewMembershipDto[];
}

export class InvitePreviewResponseDto {
  @ApiProperty({ type: () => InvitePreviewDataDto })
  data!: InvitePreviewDataDto;
}

export class EmailVerificationRequestedResponseDataDto {
  @ApiProperty({ example: true })
  requested!: boolean;

  @ApiProperty({ example: '2026-04-24T10:00:00.000Z' })
  expiresAt!: string;
}

export class EmailVerificationRequestedResponseDto {
  @ApiProperty({ type: () => EmailVerificationRequestedResponseDataDto })
  data!: EmailVerificationRequestedResponseDataDto;
}

export class EmailVerificationCompletedResponseDataDto {
  @ApiProperty({ example: true })
  verified!: boolean;
}

export class EmailVerificationCompletedResponseDto {
  @ApiProperty({ type: () => EmailVerificationCompletedResponseDataDto })
  data!: EmailVerificationCompletedResponseDataDto;
}

export class PasswordResetRequestedResponseDataDto {
  @ApiProperty({ example: true })
  requested!: boolean;
}

export class PasswordResetRequestedResponseDto {
  @ApiProperty({ type: () => PasswordResetRequestedResponseDataDto })
  data!: PasswordResetRequestedResponseDataDto;
}

export class PasswordResetCompletedResponseDataDto {
  @ApiProperty({ example: true })
  passwordReset!: boolean;
}

export class PasswordResetCompletedResponseDto {
  @ApiProperty({ type: () => PasswordResetCompletedResponseDataDto })
  data!: PasswordResetCompletedResponseDataDto;
}

export class SignOutResponseDataDto {
  @ApiProperty({ example: true })
  signedOut!: boolean;
}

export class SignOutResponseDto {
  @ApiProperty({ type: () => SignOutResponseDataDto })
  data!: SignOutResponseDataDto;
}
