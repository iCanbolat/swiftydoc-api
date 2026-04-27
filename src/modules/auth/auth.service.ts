import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import type { PortalLinkPurpose } from '../../common/portal/portal-link-types';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RemindersService } from '../../infrastructure/reminders/reminders.service';
import {
  authIdentities,
  emailVerificationTokens,
  organizations,
  passwordResetTokens,
  refreshTokens,
  roles,
  userSessions,
  users,
  workspaceMemberships,
  workspaces,
} from '../../infrastructure/database/schema';
import { INTERNAL_ROLE_NAMES } from './internal-role.types';
import type {
  AuthenticatedInternalActor,
  AuthenticatedPortalActor,
} from './auth.types';
import { OrganizationEntitlementsService } from './organization-entitlements.service';

import {
  PASSWORD_MIN_LENGTH,
  WORKSPACE_CODE_PATTERN,
  WORKSPACE_CODE_PREFIX_LENGTH,
  WORKSPACE_CODE_SUFFIX_ALPHABET,
  WORKSPACE_CODE_SUFFIX_LENGTH,
} from './auth.constants';

const scrypt = promisify(scryptCallback);

@Injectable()
export class AuthService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService<RuntimeEnv, true>,
    private readonly databaseService: DatabaseService,
    private readonly organizationEntitlementsService: OrganizationEntitlementsService,
    private readonly remindersService: RemindersService,
  ) {}

  async issueInternalUserInvite(input: {
    actorUserId?: string;
    organizationId: string;
    userId: string;
  }) {
    const context = await this.getInviteContextForUser(
      input.userId,
      input.organizationId,
    );

    if (context.user.status !== 'invited') {
      throw new ConflictException(
        'Only invited users can receive an onboarding invite.',
      );
    }

    await this.organizationEntitlementsService.assertWithinLimit(
      input.organizationId,
      'emailPerMonth',
      1,
    );

    const db = this.getDatabase();
    const now = new Date();
    const expiresAt = this.addHours(
      now,
      this.configService.get('INTERNAL_AUTH_INVITE_TOKEN_TTL_HOURS', {
        infer: true,
      }),
    );
    const inviteToken = this.createToken('inv');
    const inviteUrl = this.buildInviteUrl(inviteToken);

    await db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({
          consumedAt: now,
        })
        .where(
          and(
            eq(passwordResetTokens.userId, input.userId),
            isNull(passwordResetTokens.consumedAt),
          ),
        );

      await tx.insert(passwordResetTokens).values({
        id: randomUUID(),
        userId: input.userId,
        tokenHash: this.hashToken(inviteToken),
        expiresAt,
        consumedAt: null,
        createdAt: now,
      });
    });

    const workspaceNames = context.memberships
      .map((membership) => membership.workspaceName)
      .join(', ');
    const subject = `You're invited to ${context.organization.displayName}`;
    const message = [
      `Hello ${context.user.fullName},`,
      '',
      `You were invited to join ${context.organization.displayName} on SwiftyDoc.`,
      `Assigned workspaces: ${workspaceNames}.`,
      '',
      `Set your password and activate your account: ${inviteUrl}`,
      '',
      `This invite expires at ${expiresAt.toISOString()}.`,
    ].join('\n');

    const dispatchResult = await this.remindersService.dispatchReminder({
      organizationId: input.organizationId,
      requestId: `internal-invite:${input.userId}`,
      channel: 'email',
      recipient: context.user.email,
      subject,
      message,
      templateKey: 'internal_user_invite',
      templateVariables: {
        fullName: context.user.fullName,
        email: context.user.email,
        organizationDisplayName: context.organization.displayName,
        organizationSlug: context.organization.slug,
        inviteUrl,
        expiresAt: expiresAt.toISOString(),
        workspaceNames,
      },
      locale: context.user.locale,
      metadata: {
        inviteType: 'internal_user_onboarding',
        userId: input.userId,
      },
    });

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'email',
      action: AUDIT_ACTIONS.data_access.userInviteSent,
      organizationId: input.organizationId,
      actorId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.identity.user,
      resourceId: input.userId,
      metadata: {
        email: context.user.email,
        expiresAt: expiresAt.toISOString(),
        externalMessageId: dispatchResult.externalMessageId,
        provider: dispatchResult.provider,
      },
    });

    return {
      expiresAt: expiresAt.toISOString(),
      inviteUrl,
      externalMessageId: dispatchResult.externalMessageId,
    };
  }

  async issueEmailVerification(input: {
    actorUserId?: string;
    organizationId: string;
    userId: string;
  }) {
    const context = await this.getEmailVerificationContextForUser(
      input.userId,
      input.organizationId,
    );

    if (context.identity.emailVerifiedAt) {
      throw new ConflictException('User email is already verified.');
    }

    await this.organizationEntitlementsService.assertWithinLimit(
      input.organizationId,
      'emailPerMonth',
      1,
    );

    const db = this.getDatabase();
    const now = new Date();
    const expiresAt = this.addHours(
      now,
      this.configService.get('EMAIL_VERIFICATION_TOKEN_TTL_HOURS', {
        infer: true,
      }),
    );
    const verificationToken = this.createToken('ev');
    const verificationUrl = this.buildEmailVerificationUrl(verificationToken);

    await db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({
          consumedAt: now,
        })
        .where(
          and(
            eq(emailVerificationTokens.userId, input.userId),
            isNull(emailVerificationTokens.consumedAt),
          ),
        );

      await tx.insert(emailVerificationTokens).values({
        id: randomUUID(),
        userId: input.userId,
        tokenHash: this.hashToken(verificationToken),
        expiresAt,
        consumedAt: null,
        createdAt: now,
      });
    });

    const dispatchResult = await this.remindersService.dispatchReminder({
      organizationId: input.organizationId,
      requestId: `email-verification:${input.userId}`,
      channel: 'email',
      recipient: context.user.email,
      subject: `Verify your ${context.organization.displayName} email`,
      message: [
        `Hello ${context.user.fullName},`,
        '',
        `Please verify your email address for ${context.organization.displayName}.`,
        verificationUrl,
        '',
        `This link expires at ${expiresAt.toISOString()}.`,
      ].join('\n'),
      templateKey: 'internal_email_verification',
      templateVariables: {
        email: context.user.email,
        fullName: context.user.fullName,
        organizationDisplayName: context.organization.displayName,
        organizationSlug: context.organization.slug,
        verificationUrl,
        expiresAt: expiresAt.toISOString(),
      },
      locale: context.user.locale,
      metadata: {
        emailVerification: true,
        userId: input.userId,
      },
    });

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'email',
      action: AUDIT_ACTIONS.data_access.userEmailVerificationSent,
      organizationId: input.organizationId,
      actorId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.identity.user,
      resourceId: input.userId,
      metadata: {
        email: context.user.email,
        expiresAt: expiresAt.toISOString(),
        externalMessageId: dispatchResult.externalMessageId,
        provider: dispatchResult.provider,
      },
    });

    return {
      expiresAt: expiresAt.toISOString(),
      requested: true,
    };
  }

  async revokeInternalUserInvite(input: {
    actorUserId?: string;
    organizationId: string;
    userId: string;
  }) {
    const context = await this.getInviteContextForUser(
      input.userId,
      input.organizationId,
    );

    if (context.user.status !== 'invited') {
      throw new ConflictException(
        'Only invited users can have onboarding invites revoked.',
      );
    }

    const db = this.getDatabase();
    const now = new Date();
    const revokedTokens = await db
      .update(passwordResetTokens)
      .set({
        consumedAt: now,
      })
      .where(
        and(
          eq(passwordResetTokens.userId, input.userId),
          isNull(passwordResetTokens.consumedAt),
        ),
      )
      .returning({ id: passwordResetTokens.id });

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'api',
      action: AUDIT_ACTIONS.data_access.userInviteRevoked,
      organizationId: input.organizationId,
      actorId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.identity.user,
      resourceId: input.userId,
      metadata: {
        email: context.user.email,
        revokedTokenCount: revokedTokens.length,
      },
    });

    return {
      revoked: true,
      revokedTokenCount: revokedTokens.length,
    };
  }

  async getInvitePreview(token: string) {
    const context = await this.resolveInviteToken(token);

    return {
      email: context.user.email,
      expiresAt: context.token.expiresAt.toISOString(),
      fullName: context.user.fullName,
      organization: {
        displayName: context.organization.displayName,
        id: context.organization.id,
        slug: context.organization.slug,
      },
      memberships: context.memberships.map((membership) => ({
        roleName: membership.roleName,
        workspaceCode: membership.workspaceCode,
        workspaceId: membership.workspaceId,
        workspaceName: membership.workspaceName,
      })),
      userId: context.user.id,
    };
  }

  async completeInvite(input: { password: string; token: string }) {
    const context = await this.resolveInviteToken(input.token);

    if (context.user.status !== 'invited') {
      throw new ConflictException('Invite is already completed or invalid.');
    }

    await this.organizationEntitlementsService.assertWithinLimit(
      context.organization.id,
      'internalUsers',
      1,
    );

    const db = this.getDatabase();
    const now = new Date();
    const passwordHash = await this.hashPassword(input.password);

    await db.transaction(async (tx) => {
      const [existingIdentity] = await tx
        .select()
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.userId, context.user.id),
            eq(authIdentities.provider, 'password'),
          ),
        )
        .limit(1);

      await tx
        .update(passwordResetTokens)
        .set({ consumedAt: now })
        .where(eq(passwordResetTokens.id, context.token.id));

      if (existingIdentity) {
        await tx
          .update(authIdentities)
          .set({
            providerSubject: context.user.email,
            passwordHash,
            emailVerifiedAt: existingIdentity.emailVerifiedAt,
            lastAuthenticatedAt: now,
            updatedAt: now,
          })
          .where(eq(authIdentities.id, existingIdentity.id));
      } else {
        await tx.insert(authIdentities).values({
          id: randomUUID(),
          userId: context.user.id,
          provider: 'password',
          providerSubject: context.user.email,
          passwordHash,
          emailVerifiedAt: null,
          lastAuthenticatedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      await tx
        .update(users)
        .set({
          status: 'active',
        })
        .where(eq(users.id, context.user.id));

      await tx
        .update(workspaceMemberships)
        .set({
          status: 'active',
        })
        .where(
          and(
            eq(workspaceMemberships.userId, context.user.id),
            eq(workspaceMemberships.organizationId, context.organization.id),
          ),
        );
    });

    await this.auditLogService.record({
      category: 'security',
      channel: 'email',
      action: AUDIT_ACTIONS.security.internalAuthInviteCompleted,
      organizationId: context.organization.id,
      actorId: context.user.id,
      actorType: 'user',
      resourceType: RESOURCE_TYPES.identity.user,
      resourceId: context.user.id,
      metadata: {
        email: context.user.email,
      },
    });

    await this.issueEmailVerification({
      organizationId: context.organization.id,
      actorUserId: context.user.id,
      userId: context.user.id,
    });

    return this.signIn({
      allowUnverified: true,
      email: context.user.email,
      password: input.password,
    });
  }

  async requestPasswordReset(input: {
    email: string;
    organizationSlug: string;
  }) {
    const db = this.getDatabase();
    const normalizedEmail = this.normalizeEmail(input.email);
    const organizationSlug = this.normalizeSlug(input.organizationSlug);
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, organizationSlug))
      .limit(1);

    if (!organization || organization.status !== 'active') {
      return { requested: true };
    }

    const [identityRecord] = await db
      .select({
        identity: authIdentities,
        user: users,
      })
      .from(authIdentities)
      .innerJoin(users, eq(authIdentities.userId, users.id))
      .where(
        and(
          eq(authIdentities.provider, 'password'),
          eq(authIdentities.providerSubject, normalizedEmail),
        ),
      )
      .limit(1);

    if (!identityRecord || identityRecord.user.status !== 'active') {
      return { requested: true };
    }

    const activeMemberships = await this.listActiveMemberships(
      identityRecord.user.id,
      organization.id,
    );

    if (activeMemberships.length === 0) {
      return { requested: true };
    }

    await this.organizationEntitlementsService.assertWithinLimit(
      organization.id,
      'emailPerMonth',
      1,
    );

    const now = new Date();
    const expiresAt = this.addMinutes(
      now,
      this.configService.get('PASSWORD_RESET_TOKEN_TTL_MINUTES', {
        infer: true,
      }),
    );
    const resetToken = this.createToken('pw');
    const resetUrl = this.buildPasswordResetUrl(resetToken);

    await db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({
          consumedAt: now,
        })
        .where(
          and(
            eq(passwordResetTokens.userId, identityRecord.user.id),
            isNull(passwordResetTokens.consumedAt),
          ),
        );

      await tx.insert(passwordResetTokens).values({
        id: randomUUID(),
        userId: identityRecord.user.id,
        tokenHash: this.hashToken(resetToken),
        expiresAt,
        consumedAt: null,
        createdAt: now,
      });
    });

    const dispatchResult = await this.remindersService.dispatchReminder({
      organizationId: organization.id,
      requestId: `password-reset:${identityRecord.user.id}`,
      channel: 'email',
      recipient: identityRecord.user.email,
      subject: `Reset your ${organization.displayName} password`,
      message: [
        `Hello ${identityRecord.user.fullName},`,
        '',
        `Use the link below to reset your password for ${organization.displayName}.`,
        resetUrl,
        '',
        `This link expires at ${expiresAt.toISOString()}.`,
      ].join('\n'),
      templateKey: 'internal_password_reset',
      templateVariables: {
        email: identityRecord.user.email,
        fullName: identityRecord.user.fullName,
        organizationDisplayName: organization.displayName,
        organizationSlug: organization.slug,
        resetUrl,
        expiresAt: expiresAt.toISOString(),
      },
      locale: identityRecord.user.locale,
      metadata: {
        passwordReset: true,
        userId: identityRecord.user.id,
      },
    });

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'email',
      action: AUDIT_ACTIONS.data_access.userPasswordResetRequested,
      organizationId: organization.id,
      actorId: identityRecord.user.id,
      actorType: 'user',
      resourceType: RESOURCE_TYPES.identity.user,
      resourceId: identityRecord.user.id,
      metadata: {
        email: identityRecord.user.email,
        expiresAt: expiresAt.toISOString(),
        externalMessageId: dispatchResult.externalMessageId,
        provider: dispatchResult.provider,
      },
    });

    return { requested: true };
  }

  async resetPassword(input: { password: string; token: string }) {
    const context = await this.resolvePasswordResetToken(input.token);
    const db = this.getDatabase();
    const now = new Date();
    const passwordHash = await this.hashPassword(input.password);

    await db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({ consumedAt: now })
        .where(eq(passwordResetTokens.id, context.token.id));

      await tx
        .update(authIdentities)
        .set({
          passwordHash,
          emailVerifiedAt: context.identity.emailVerifiedAt,
          lastAuthenticatedAt: now,
          updatedAt: now,
        })
        .where(eq(authIdentities.id, context.identity.id));

      await tx
        .update(userSessions)
        .set({
          revokedAt: now,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(userSessions.userId, context.user.id),
            isNull(userSessions.revokedAt),
          ),
        );

      await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(
          and(
            eq(refreshTokens.userId, context.user.id),
            isNull(refreshTokens.revokedAt),
          ),
        );
    });

    await this.auditLogService.record({
      category: 'security',
      channel: 'email',
      action: AUDIT_ACTIONS.security.internalAuthPasswordResetCompleted,
      organizationId: context.organization.id,
      actorId: context.user.id,
      actorType: 'user',
      resourceType: RESOURCE_TYPES.identity.user,
      resourceId: context.user.id,
      metadata: {
        email: context.user.email,
      },
    });

    return { passwordReset: true };
  }

  async verifyEmail(input: { token: string }) {
    const context = await this.resolveEmailVerificationToken(input.token);
    const db = this.getDatabase();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: now })
        .where(eq(emailVerificationTokens.id, context.token.id));

      await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(emailVerificationTokens.userId, context.user.id),
            isNull(emailVerificationTokens.consumedAt),
          ),
        );

      await tx
        .update(authIdentities)
        .set({
          emailVerifiedAt: now,
          updatedAt: now,
        })
        .where(eq(authIdentities.id, context.identity.id));
    });

    await this.auditLogService.record({
      category: 'security',
      channel: 'email',
      action: AUDIT_ACTIONS.security.internalAuthEmailVerified,
      organizationId: context.organization.id,
      actorId: context.user.id,
      actorType: 'user',
      resourceType: RESOURCE_TYPES.identity.user,
      resourceId: context.user.id,
      metadata: {
        email: context.user.email,
      },
    });

    return { verified: true };
  }

  async bootstrapOwner(input: {
    legalName?: string;
    locale?: string;
    organizationName: string;
    organizationSlug: string;
    ownerEmail: string;
    ownerFullName: string;
    password: string;
    phone?: string;
    primaryRegion?: string;
    timezone?: string;
    workspaceCode?: string;
    workspaceName: string;
  }) {
    this.assertBootstrapSignupEnabled();

    const passwordHash = await this.hashPassword(input.password);
    const result = await this.createBootstrappedOwnerSession({
      authIdentity: {
        emailVerifiedAt: null,
        passwordHash,
        provider: 'password',
        providerSubject: this.normalizeEmail(input.ownerEmail),
      },
      legalName: input.legalName,
      locale: input.locale,
      organizationName: input.organizationName,
      organizationSlug: input.organizationSlug,
      ownerEmail: input.ownerEmail,
      ownerFullName: input.ownerFullName,
      phone: input.phone,
      primaryRegion: input.primaryRegion,
      timezone: input.timezone,
      workspaceCode: input.workspaceCode,
      workspaceName: input.workspaceName,
    });

    await this.auditLogService.record({
      category: 'security',
      channel: 'api',
      action: AUDIT_ACTIONS.security.internalAuthBootstrapCompleted,
      authSurface: 'internal',
      organizationId: result.organization.id,
      actorId: result.userId,
      actorType: 'user',
      sessionId: result.sessionArtifacts.sessionId,
      activeWorkspaceId:
        result.sessionArtifacts.sessionValues.activeWorkspaceId,
      resourceType: RESOURCE_TYPES.identity.organization,
      resourceId: result.organization.id,
      metadata: {
        authProvider: 'password',
        organizationSlug: result.organization.slug,
      },
    });

    const actor = await this.getAuthenticatedActor(
      result.sessionArtifacts.sessionId,
    );

    await this.issueEmailVerification({
      organizationId: result.organization.id,
      actorUserId: result.userId,
      userId: result.userId,
    });

    return {
      actor,
      refreshToken: result.sessionArtifacts.refreshToken,
      tokens: this.serializeTokens(result.sessionArtifacts),
    };
  }

  async signIn(input: {
    allowUnverified?: boolean;
    email: string;
    password: string;
  }) {
    const db = this.getDatabase();
    const normalizedEmail = this.normalizeEmail(input.email);

    const [identityRecord] = await db
      .select({
        identity: authIdentities,
        user: users,
      })
      .from(authIdentities)
      .innerJoin(users, eq(authIdentities.userId, users.id))
      .where(
        and(
          eq(authIdentities.provider, 'password'),
          eq(authIdentities.providerSubject, normalizedEmail),
        ),
      )
      .limit(1);

    if (
      !identityRecord?.identity.passwordHash ||
      !(await this.verifyPassword(
        input.password,
        identityRecord.identity.passwordHash,
      ))
    ) {
      throw new UnauthorizedException('Credentials are invalid.');
    }

    if (identityRecord.user.status !== 'active') {
      throw new ForbiddenException('User account is not active.');
    }

    const emailVerificationState = await this.getUserEmailVerificationState(
      identityRecord.user.id,
    );

    if (!input.allowUnverified && !emailVerificationState.emailVerifiedAt) {
      throw new ForbiddenException(
        'Email verification is required before sign in.',
      );
    }

    const organization = await this.resolveSingleActiveOrganizationForUser(
      identityRecord.user.id,
    );

    if (!organization) {
      throw new ForbiddenException(
        'User does not have an active workspace membership.',
      );
    }

    const activeMemberships = await this.listActiveMemberships(
      identityRecord.user.id,
      organization.id,
    );

    if (activeMemberships.length === 0) {
      throw new ForbiddenException(
        'User does not have an active workspace membership.',
      );
    }

    const now = new Date();
    const sessionArtifacts = this.issueSessionArtifacts({
      activeWorkspaceId: activeMemberships[0].workspaceId,
      organizationId: organization.id,
      userAgent: null,
      userId: identityRecord.user.id,
      ipAddress: null,
    });

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          lastLoginAt: now,
        })
        .where(eq(users.id, identityRecord.user.id));

      await tx
        .update(authIdentities)
        .set({
          lastAuthenticatedAt: now,
          updatedAt: now,
        })
        .where(eq(authIdentities.id, identityRecord.identity.id));

      await tx.insert(userSessions).values(sessionArtifacts.sessionValues);
      await tx
        .insert(refreshTokens)
        .values(sessionArtifacts.refreshTokenValues);
    });

    await this.auditLogService.record({
      category: 'security',
      channel: 'api',
      action: AUDIT_ACTIONS.security.internalAuthSessionStarted,
      authSurface: 'internal',
      organizationId: organization.id,
      actorId: identityRecord.user.id,
      actorType: 'user',
      sessionId: sessionArtifacts.sessionId,
      activeWorkspaceId: sessionArtifacts.sessionValues.activeWorkspaceId,
      resourceType: RESOURCE_TYPES.identity.userSession,
      resourceId: sessionArtifacts.sessionId,
      metadata: {
        roleNames: [...new Set(activeMemberships.map((item) => item.roleName))],
      },
    });

    const actor = await this.getAuthenticatedActor(sessionArtifacts.sessionId);

    return {
      actor,
      refreshToken: sessionArtifacts.refreshToken,
      tokens: this.serializeTokens(sessionArtifacts),
    };
  }

  async refreshSession(refreshTokenValue: string) {
    const db = this.getDatabase();
    const now = new Date();
    const refreshTokenHash = this.hashToken(refreshTokenValue);
    const [storedRefreshToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, refreshTokenHash))
      .limit(1);

    if (!storedRefreshToken) {
      throw new UnauthorizedException('Refresh token is invalid.');
    }

    if (storedRefreshToken.revokedAt || storedRefreshToken.consumedAt) {
      await this.revokeRefreshFamilyAndSession({
        familyId: storedRefreshToken.familyId,
        revokedAt: now,
        sessionId: storedRefreshToken.sessionId,
      });

      await this.recordRefreshReplayDetected({
        familyId: storedRefreshToken.familyId,
        reason: storedRefreshToken.revokedAt ? 'revoked' : 'consumed',
        refreshTokenId: storedRefreshToken.id,
        sessionId: storedRefreshToken.sessionId,
        userId: storedRefreshToken.userId,
      });

      throw new UnauthorizedException('Refresh token is invalid.');
    }

    if (storedRefreshToken.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException('Refresh token is invalid.');
    }

    const [sessionRecord] = await db
      .select({
        organization: organizations,
        session: userSessions,
        user: users,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .innerJoin(
        organizations,
        eq(userSessions.organizationId, organizations.id),
      )
      .where(
        and(
          eq(userSessions.id, storedRefreshToken.sessionId),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, now),
        ),
      )
      .limit(1);

    if (
      !sessionRecord ||
      sessionRecord.user.status !== 'active' ||
      sessionRecord.organization.status !== 'active'
    ) {
      throw new UnauthorizedException('Refresh token is invalid.');
    }

    const emailVerificationState = await this.getUserEmailVerificationState(
      sessionRecord.user.id,
    );

    if (!emailVerificationState.emailVerifiedAt) {
      await db.transaction(async (tx) => {
        await tx
          .update(refreshTokens)
          .set({
            revokedAt: now,
          })
          .where(
            and(
              eq(refreshTokens.sessionId, sessionRecord.session.id),
              isNull(refreshTokens.revokedAt),
            ),
          );

        await tx
          .update(userSessions)
          .set({
            revokedAt: now,
            lastSeenAt: now,
            updatedAt: now,
          })
          .where(eq(userSessions.id, sessionRecord.session.id));
      });

      throw new ForbiddenException(
        'Email verification is required before continuing the session.',
      );
    }

    const rotatedArtifacts = this.issueSessionArtifacts({
      activeWorkspaceId: sessionRecord.session.activeWorkspaceId,
      organizationId: sessionRecord.session.organizationId,
      userAgent: sessionRecord.session.userAgent,
      userId: sessionRecord.session.userId,
      ipAddress: sessionRecord.session.ipAddress,
      familyId: storedRefreshToken.familyId,
      sessionId: sessionRecord.session.id,
    });

    let rotationConflictDetected = false;

    await db.transaction(async (tx) => {
      const consumedRefreshTokens = await tx
        .update(refreshTokens)
        .set({
          consumedAt: now,
          replacedByTokenId: rotatedArtifacts.refreshTokenId,
        })
        .where(
          and(
            eq(refreshTokens.id, storedRefreshToken.id),
            isNull(refreshTokens.revokedAt),
            isNull(refreshTokens.consumedAt),
            gt(refreshTokens.expiresAt, now),
          ),
        )
        .returning({ id: refreshTokens.id });

      if (consumedRefreshTokens.length !== 1) {
        rotationConflictDetected = true;

        await tx
          .update(refreshTokens)
          .set({
            revokedAt: now,
          })
          .where(
            and(
              eq(refreshTokens.familyId, storedRefreshToken.familyId),
              eq(refreshTokens.sessionId, storedRefreshToken.sessionId),
              isNull(refreshTokens.revokedAt),
            ),
          );

        await tx
          .update(userSessions)
          .set({
            revokedAt: now,
            lastSeenAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(userSessions.id, sessionRecord.session.id),
              isNull(userSessions.revokedAt),
            ),
          );

        return;
      }

      await tx
        .update(userSessions)
        .set({
          accessTokenHash: rotatedArtifacts.sessionValues.accessTokenHash,
          activeWorkspaceId: rotatedArtifacts.sessionValues.activeWorkspaceId,
          expiresAt: rotatedArtifacts.sessionValues.expiresAt,
          ipAddress: rotatedArtifacts.sessionValues.ipAddress,
          lastSeenAt: now,
          updatedAt: now,
          userAgent: rotatedArtifacts.sessionValues.userAgent,
        })
        .where(eq(userSessions.id, sessionRecord.session.id));

      await tx
        .insert(refreshTokens)
        .values(rotatedArtifacts.refreshTokenValues);
    });

    if (rotationConflictDetected) {
      await this.recordRefreshReplayDetected({
        familyId: storedRefreshToken.familyId,
        reason: 'rotation_conflict',
        refreshTokenId: storedRefreshToken.id,
        sessionId: storedRefreshToken.sessionId,
        userId: storedRefreshToken.userId,
      });

      throw new UnauthorizedException('Refresh token is invalid.');
    }

    await this.auditLogService.record({
      category: 'security',
      channel: 'api',
      action: AUDIT_ACTIONS.security.internalAuthSessionRefreshed,
      authSurface: 'internal',
      organizationId: sessionRecord.session.organizationId,
      actorId: sessionRecord.session.userId,
      actorType: 'user',
      sessionId: sessionRecord.session.id,
      activeWorkspaceId: rotatedArtifacts.sessionValues.activeWorkspaceId,
      resourceType: RESOURCE_TYPES.identity.userSession,
      resourceId: sessionRecord.session.id,
      metadata: {
        refreshTokenId: rotatedArtifacts.refreshTokenId,
      },
    });

    const actor = await this.getAuthenticatedActor(sessionRecord.session.id);

    return {
      actor,
      refreshToken: rotatedArtifacts.refreshToken,
      tokens: this.serializeTokens(rotatedArtifacts),
    };
  }

  async getCurrentActor(
    accessToken: string,
  ): Promise<AuthenticatedInternalActor> {
    const sessionRecord = await this.getSessionByAccessToken(accessToken);
    return this.getAuthenticatedActor(sessionRecord.session.id);
  }

  async issuePortalAccessToken(input: {
    organizationId: string;
    portalLinkId: string;
    purpose: PortalLinkPurpose;
    recipientId: string | null;
    requestId: string;
    submissionId: string | null;
  }) {
    const issuedAt = new Date();
    const expiresAt = this.addMinutes(
      issuedAt,
      this.configService.get('PORTAL_AUTH_TOKEN_TTL_MINUTES', {
        infer: true,
      }),
    );
    const serializedPayload = Buffer.from(
      JSON.stringify({
        exp: expiresAt.toISOString(),
        iat: issuedAt.toISOString(),
        organizationId: input.organizationId,
        portalLinkId: input.portalLinkId,
        purpose: input.purpose,
        recipientId: input.recipientId,
        requestId: input.requestId,
        submissionId: input.submissionId,
        type: 'portal',
      }),
    ).toString('base64url');
    const signature = this.signPortalPayload(serializedPayload);

    await this.auditLogService.record({
      category: 'security',
      channel: 'api',
      action: AUDIT_ACTIONS.security.portalAuthSessionStarted,
      organizationId: input.organizationId,
      actorId: input.recipientId ?? undefined,
      actorType: input.recipientId ? 'recipient' : undefined,
      resourceType: RESOURCE_TYPES.documents.portalLink,
      resourceId: input.portalLinkId,
      metadata: {
        expiresAt: expiresAt.toISOString(),
        requestId: input.requestId,
        submissionId: input.submissionId,
      },
    });

    return {
      accessToken: `swd_pt_${serializedPayload}.${signature}`,
      expiresAt: expiresAt.toISOString(),
      tokenType: 'Portal',
    };
  }

  async verifyPortalAccessToken(
    portalAccessToken: string,
  ): Promise<AuthenticatedPortalActor> {
    const tokenBody = portalAccessToken.startsWith('swd_pt_')
      ? portalAccessToken.slice('swd_pt_'.length)
      : null;

    if (!tokenBody) {
      throw new UnauthorizedException(
        'Portal access token is missing or invalid.',
      );
    }

    const [serializedPayload, signature] = tokenBody.split('.', 2);

    if (!serializedPayload || !signature) {
      throw new UnauthorizedException(
        'Portal access token is missing or invalid.',
      );
    }

    const expectedSignature = this.signPortalPayload(serializedPayload);
    const actualBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException(
        'Portal access token is missing or invalid.',
      );
    }

    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(
        Buffer.from(serializedPayload, 'base64url').toString('utf8'),
      ) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException(
        'Portal access token is missing or invalid.',
      );
    }

    const expiresAt = this.readPortalTokenString(payload, 'exp');
    const parsedExpiresAt = new Date(expiresAt);

    if (
      Number.isNaN(parsedExpiresAt.getTime()) ||
      parsedExpiresAt.getTime() <= Date.now() ||
      this.readPortalTokenString(payload, 'type') !== 'portal'
    ) {
      throw new UnauthorizedException('Portal access token has expired.');
    }

    return {
      expiresAt,
      organizationId: this.readPortalTokenString(payload, 'organizationId'),
      portalLinkId: this.readPortalTokenString(payload, 'portalLinkId'),
      purpose: this.readPortalTokenString(
        payload,
        'purpose',
      ) as PortalLinkPurpose,
      recipientId: this.readNullablePortalTokenString(payload, 'recipientId'),
      requestId: this.readPortalTokenString(payload, 'requestId'),
      submissionId: this.readNullablePortalTokenString(payload, 'submissionId'),
    };
  }

  async signOut(accessToken: string): Promise<void> {
    const sessionRecord = await this.getSessionByAccessToken(accessToken);
    const now = new Date();

    await this.revokeRefreshFamilyAndSession({
      revokedAt: now,
      sessionId: sessionRecord.session.id,
    });

    await this.auditLogService.record({
      category: 'security',
      channel: 'api',
      action: AUDIT_ACTIONS.security.internalAuthSessionEnded,
      organizationId: sessionRecord.session.organizationId,
      actorId: sessionRecord.session.userId,
      actorType: 'user',
      resourceType: RESOURCE_TYPES.identity.userSession,
      resourceId: sessionRecord.session.id,
    });
  }

  public async createInternalSessionForIdentity(input: {
    activeWorkspaceId: string;
    emailVerifiedAt: Date | null;
    identityId: string;
    organizationId: string;
    roleNames: string[];
    userId: string;
  }) {
    const db = this.getDatabase();
    const now = new Date();
    const sessionArtifacts = this.issueSessionArtifacts({
      activeWorkspaceId: input.activeWorkspaceId,
      organizationId: input.organizationId,
      userAgent: null,
      userId: input.userId,
      ipAddress: null,
    });

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          lastLoginAt: now,
        })
        .where(eq(users.id, input.userId));

      await tx
        .update(authIdentities)
        .set({
          emailVerifiedAt: input.emailVerifiedAt ?? undefined,
          lastAuthenticatedAt: now,
          updatedAt: now,
        })
        .where(eq(authIdentities.id, input.identityId));

      if (input.emailVerifiedAt) {
        await tx
          .update(authIdentities)
          .set({
            emailVerifiedAt: input.emailVerifiedAt,
            updatedAt: now,
          })
          .where(
            and(
              eq(authIdentities.userId, input.userId),
              eq(authIdentities.provider, 'password'),
              isNull(authIdentities.emailVerifiedAt),
            ),
          );
      }

      await tx.insert(userSessions).values(sessionArtifacts.sessionValues);
      await tx
        .insert(refreshTokens)
        .values(sessionArtifacts.refreshTokenValues);
    });

    await this.auditLogService.record({
      category: 'security',
      channel: 'api',
      action: AUDIT_ACTIONS.security.internalAuthSessionStarted,
      authSurface: 'internal',
      organizationId: input.organizationId,
      actorId: input.userId,
      actorType: 'user',
      sessionId: sessionArtifacts.sessionId,
      activeWorkspaceId: input.activeWorkspaceId,
      resourceType: RESOURCE_TYPES.identity.userSession,
      resourceId: sessionArtifacts.sessionId,
      metadata: {
        roleNames: input.roleNames,
      },
    });

    const actor = await this.getAuthenticatedActor(sessionArtifacts.sessionId);

    return {
      actor,
      refreshToken: sessionArtifacts.refreshToken,
      tokens: this.serializeTokens(sessionArtifacts),
    };
  }

  public assertBootstrapSignupEnabled() {
    if (
      !this.configService.get('AUTH_BOOTSTRAP_ALLOW_SIGNUP', { infer: true })
    ) {
      throw new ForbiddenException('Bootstrap signup is disabled.');
    }
  }

  public async createBootstrappedOwnerSession(input: {
    authIdentity: {
      emailVerifiedAt: Date | null;
      passwordHash?: string;
      provider: 'google_oidc' | 'password';
      providerSubject: string;
    };
    legalName?: string;
    locale?: string;
    organizationName: string;
    organizationSlug: string;
    ownerEmail: string;
    ownerFullName: string;
    phone?: string;
    primaryRegion?: string;
    timezone?: string;
    workspaceCode?: string;
    workspaceName: string;
  }) {
    const db = this.getDatabase();
    const normalizedEmail = this.normalizeEmail(input.ownerEmail);
    const organizationSlug = this.normalizeSlug(input.organizationSlug);
    const workspaceCode = this.buildWorkspaceCode(
      input.organizationName,
      input.workspaceCode,
    );
    const now = new Date();

    try {
      return await db.transaction(async (tx) => {
        const organizationId = randomUUID();
        const workspaceId = randomUUID();
        const userId = randomUUID();

        const [organization] = await tx
          .insert(organizations)
          .values({
            id: organizationId,
            slug: organizationSlug,
            displayName: input.organizationName.trim(),
            legalName: this.normalizeOptionalString(input.legalName) ?? null,
            defaultLocale: this.normalizeOptionalString(input.locale) ?? 'en',
            primaryRegion:
              this.normalizeOptionalString(input.primaryRegion) ?? 'mena',
            timezone: this.normalizeOptionalString(input.timezone) ?? 'UTC',
            planTier: 'foundation',
            dataResidencyPolicy: 'standard',
            status: 'active',
            createdAt: now,
            archivedAt: null,
          })
          .returning();

        const seededRoles = await tx
          .insert(roles)
          .values(
            INTERNAL_ROLE_NAMES.map((roleName) => ({
              id: randomUUID(),
              organizationId,
              name: roleName,
              isSystemRole: true,
              createdAt: now,
            })),
          )
          .returning();

        const ownerRole = seededRoles.find(
          (role) => role.name === 'organization_owner',
        );

        if (!ownerRole) {
          throw new Error('Missing organization owner role seed.');
        }

        await tx.insert(workspaces).values({
          id: workspaceId,
          organizationId,
          name: input.workspaceName.trim(),
          code: workspaceCode,
          defaultBrandingId: null,
          defaultReminderPolicyId: null,
          status: 'active',
          createdAt: now,
        });

        await tx.insert(users).values({
          id: userId,
          email: normalizedEmail,
          fullName: input.ownerFullName.trim(),
          locale: this.normalizeOptionalString(input.locale) ?? 'en',
          phone: this.normalizeOptionalString(input.phone) ?? null,
          status: 'active',
          lastLoginAt: now,
          createdAt: now,
        });

        await tx.insert(authIdentities).values({
          id: randomUUID(),
          userId,
          provider: input.authIdentity.provider,
          providerSubject:
            input.authIdentity.provider === 'password'
              ? normalizedEmail
              : input.authIdentity.providerSubject.trim(),
          passwordHash: input.authIdentity.passwordHash ?? null,
          emailVerifiedAt: input.authIdentity.emailVerifiedAt,
          lastAuthenticatedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        await tx.insert(workspaceMemberships).values({
          id: randomUUID(),
          organizationId,
          workspaceId,
          userId,
          roleId: ownerRole.id,
          status: 'active',
          createdAt: now,
        });

        const sessionArtifacts = this.issueSessionArtifacts({
          activeWorkspaceId: workspaceId,
          organizationId,
          userAgent: null,
          userId,
          ipAddress: null,
        });

        await tx.insert(userSessions).values(sessionArtifacts.sessionValues);
        await tx
          .insert(refreshTokens)
          .values(sessionArtifacts.refreshTokenValues);

        return {
          organization,
          sessionArtifacts,
          userId,
        };
      });
    } catch (error) {
      this.rethrowConstraintViolation(error);
      throw error;
    }
  }

  public async resolveInviteToken(token: string) {
    const db = this.getDatabase();
    const now = new Date();
    const [tokenRecord] = await db
      .select({
        token: passwordResetTokens,
        user: users,
      })
      .from(passwordResetTokens)
      .innerJoin(users, eq(passwordResetTokens.userId, users.id))
      .where(
        and(
          eq(passwordResetTokens.tokenHash, this.hashToken(token)),
          isNull(passwordResetTokens.consumedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .limit(1);

    if (!tokenRecord) {
      throw new UnauthorizedException('Invite token is invalid or expired.');
    }

    const memberships = await db
      .select({
        organizationId: workspaceMemberships.organizationId,
        roleName: roles.name,
        workspaceCode: workspaces.code,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
      })
      .from(workspaceMemberships)
      .innerJoin(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      )
      .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
      .where(
        and(
          eq(workspaceMemberships.userId, tokenRecord.user.id),
          inArray(workspaceMemberships.status, ['invited', 'active']),
        ),
      )
      .orderBy(asc(workspaces.name));

    if (memberships.length === 0) {
      throw new ForbiddenException(
        'Invite does not have an active organization membership.',
      );
    }

    const organizationIds = [
      ...new Set(memberships.map((item) => item.organizationId)),
    ];

    if (organizationIds.length !== 1) {
      throw new ForbiddenException(
        'Invite must resolve to exactly one organization.',
      );
    }

    const [organization] = await db
      .select({
        displayName: organizations.displayName,
        id: organizations.id,
        slug: organizations.slug,
        status: organizations.status,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationIds[0]))
      .limit(1);

    if (!organization || organization.status !== 'active') {
      throw new UnauthorizedException('Invite token is invalid or expired.');
    }

    return {
      memberships,
      organization,
      token: tokenRecord.token,
      user: tokenRecord.user,
    };
  }

  private async resolvePasswordResetToken(token: string) {
    const db = this.getDatabase();
    const now = new Date();
    const [tokenRecord] = await db
      .select({
        identity: authIdentities,
        token: passwordResetTokens,
        user: users,
      })
      .from(passwordResetTokens)
      .innerJoin(users, eq(passwordResetTokens.userId, users.id))
      .innerJoin(
        authIdentities,
        and(
          eq(authIdentities.userId, users.id),
          eq(authIdentities.provider, 'password'),
        ),
      )
      .where(
        and(
          eq(passwordResetTokens.tokenHash, this.hashToken(token)),
          isNull(passwordResetTokens.consumedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .limit(1);

    if (!tokenRecord || tokenRecord.user.status !== 'active') {
      throw new UnauthorizedException(
        'Password reset token is invalid or expired.',
      );
    }

    const memberships = await db
      .select({ organizationId: workspaceMemberships.organizationId })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.userId, tokenRecord.user.id),
          eq(workspaceMemberships.status, 'active'),
        ),
      );
    const organizationIds = [
      ...new Set(memberships.map((item) => item.organizationId)),
    ];

    if (organizationIds.length === 0) {
      throw new UnauthorizedException(
        'Password reset token is invalid or expired.',
      );
    }

    const [organization] = await db
      .select({
        displayName: organizations.displayName,
        id: organizations.id,
        slug: organizations.slug,
        status: organizations.status,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationIds[0]))
      .limit(1);

    if (!organization || organization.status !== 'active') {
      throw new UnauthorizedException(
        'Password reset token is invalid or expired.',
      );
    }

    return {
      identity: tokenRecord.identity,
      organization,
      token: tokenRecord.token,
      user: tokenRecord.user,
    };
  }

  private async resolveEmailVerificationToken(token: string) {
    const db = this.getDatabase();
    const now = new Date();
    const [tokenRecord] = await db
      .select({
        identity: authIdentities,
        token: emailVerificationTokens,
        user: users,
      })
      .from(emailVerificationTokens)
      .innerJoin(users, eq(emailVerificationTokens.userId, users.id))
      .innerJoin(
        authIdentities,
        and(
          eq(authIdentities.userId, users.id),
          eq(authIdentities.provider, 'password'),
        ),
      )
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, this.hashToken(token)),
          isNull(emailVerificationTokens.consumedAt),
          gt(emailVerificationTokens.expiresAt, now),
        ),
      )
      .limit(1);

    if (!tokenRecord) {
      throw new UnauthorizedException(
        'Email verification token is invalid or expired.',
      );
    }

    const organization = await this.resolveOrganizationForUser(
      tokenRecord.user.id,
    );

    return {
      identity: tokenRecord.identity,
      organization,
      token: tokenRecord.token,
      user: tokenRecord.user,
    };
  }

  private async getEmailVerificationContextForUser(
    userId: string,
    organizationId: string,
  ) {
    const context = await this.getInviteContextForUser(userId, organizationId);
    const emailVerificationState =
      await this.getUserEmailVerificationState(userId);

    if (emailVerificationState.emailVerifiedAt) {
      throw new ConflictException('User email is already verified.');
    }

    const db = this.getDatabase();
    const [identity] = await db
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.userId, userId),
          eq(authIdentities.provider, 'password'),
        ),
      )
      .limit(1);

    if (!identity) {
      throw new ConflictException(
        'Email verification requires an initialized password identity.',
      );
    }

    return {
      ...context,
      identity,
    };
  }

  private async resolveOrganizationForUser(userId: string) {
    const db = this.getDatabase();
    const memberships = await db
      .select({ organizationId: workspaceMemberships.organizationId })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.userId, userId),
          inArray(workspaceMemberships.status, ['active', 'invited']),
        ),
      );
    const organizationIds = [
      ...new Set(memberships.map((item) => item.organizationId)),
    ];

    if (organizationIds.length !== 1) {
      throw new UnauthorizedException(
        'Email verification token is invalid or expired.',
      );
    }

    const [organization] = await db
      .select({
        displayName: organizations.displayName,
        id: organizations.id,
        slug: organizations.slug,
        status: organizations.status,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationIds[0]))
      .limit(1);

    if (!organization || organization.status !== 'active') {
      throw new UnauthorizedException(
        'Email verification token is invalid or expired.',
      );
    }

    return organization;
  }

  private async getInviteContextForUser(
    userId: string,
    organizationId: string,
  ) {
    const db = this.getDatabase();
    const [user] = await db
      .select({
        email: users.email,
        fullName: users.fullName,
        id: users.id,
        locale: users.locale,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [organization] = await db
      .select({
        displayName: organizations.displayName,
        id: organizations.id,
        slug: organizations.slug,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    const memberships = await db
      .select({
        roleName: roles.name,
        workspaceCode: workspaces.code,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
      })
      .from(workspaceMemberships)
      .innerJoin(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      )
      .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
      .where(
        and(
          eq(workspaceMemberships.userId, userId),
          eq(workspaceMemberships.organizationId, organizationId),
          inArray(workspaceMemberships.status, ['invited', 'active']),
        ),
      )
      .orderBy(asc(workspaces.name));

    if (memberships.length === 0) {
      throw new ForbiddenException(
        'User does not have invite-eligible workspace memberships.',
      );
    }

    return {
      memberships,
      organization,
      user,
    };
  }

  private async getAuthenticatedActor(
    sessionId: string,
  ): Promise<AuthenticatedInternalActor> {
    const db = this.getDatabase();
    const now = new Date();
    const [sessionRecord] = await db
      .select({
        organization: organizations,
        session: userSessions,
        user: users,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .innerJoin(
        organizations,
        eq(userSessions.organizationId, organizations.id),
      )
      .where(
        and(
          eq(userSessions.id, sessionId),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, now),
        ),
      )
      .limit(1);

    if (
      !sessionRecord ||
      sessionRecord.user.status !== 'active' ||
      sessionRecord.organization.status !== 'active'
    ) {
      throw new UnauthorizedException('Session is invalid or expired.');
    }

    const memberships = await this.listActiveMemberships(
      sessionRecord.user.id,
      sessionRecord.organization.id,
    );

    const emailVerificationState = await this.getUserEmailVerificationState(
      sessionRecord.user.id,
    );

    if (memberships.length === 0) {
      throw new ForbiddenException(
        'User does not have an active workspace membership.',
      );
    }

    const activeWorkspaceId =
      memberships.find(
        (membership) =>
          membership.workspaceId === sessionRecord.session.activeWorkspaceId,
      )?.workspaceId ?? memberships[0].workspaceId;

    if (activeWorkspaceId !== sessionRecord.session.activeWorkspaceId) {
      await db
        .update(userSessions)
        .set({
          activeWorkspaceId,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(userSessions.id, sessionRecord.session.id));
    } else {
      await db
        .update(userSessions)
        .set({
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(userSessions.id, sessionRecord.session.id));
    }

    return {
      memberships,
      organization: {
        createdAt: sessionRecord.organization.createdAt.toISOString(),
        defaultLocale: sessionRecord.organization.defaultLocale,
        displayName: sessionRecord.organization.displayName,
        id: sessionRecord.organization.id,
        planTier: sessionRecord.organization.planTier,
        primaryRegion: sessionRecord.organization.primaryRegion,
        slug: sessionRecord.organization.slug,
        status: sessionRecord.organization.status,
        timezone: sessionRecord.organization.timezone,
      },
      roleNames: [
        ...new Set(memberships.map((membership) => membership.roleName)),
      ],
      session: {
        activeWorkspaceId,
        expiresAt: sessionRecord.session.expiresAt.toISOString(),
        id: sessionRecord.session.id,
      },
      user: {
        createdAt: sessionRecord.user.createdAt.toISOString(),
        email: sessionRecord.user.email,
        emailVerifiedAt:
          emailVerificationState.emailVerifiedAt?.toISOString() ?? null,
        fullName: sessionRecord.user.fullName,
        id: sessionRecord.user.id,
        lastLoginAt: sessionRecord.user.lastLoginAt?.toISOString() ?? null,
        locale: sessionRecord.user.locale,
        phone: sessionRecord.user.phone,
        status: sessionRecord.user.status,
      },
    };
  }

  private async getSessionByAccessToken(accessToken: string) {
    const db = this.getDatabase();
    const now = new Date();
    const [sessionRecord] = await db
      .select({
        organization: organizations,
        session: userSessions,
        user: users,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .innerJoin(
        organizations,
        eq(userSessions.organizationId, organizations.id),
      )
      .where(
        and(
          eq(userSessions.accessTokenHash, this.hashToken(accessToken)),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, now),
        ),
      )
      .limit(1);

    if (
      !sessionRecord ||
      sessionRecord.user.status !== 'active' ||
      sessionRecord.organization.status !== 'active'
    ) {
      throw new UnauthorizedException('Bearer token is missing or invalid.');
    }

    return sessionRecord;
  }

  public async listActiveMemberships(userId: string, organizationId: string) {
    const db = this.getDatabase();

    return db
      .select({
        membershipId: workspaceMemberships.id,
        roleId: roles.id,
        roleName: roles.name,
        status: workspaceMemberships.status,
        workspaceCode: workspaces.code,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
      })
      .from(workspaceMemberships)
      .innerJoin(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      )
      .innerJoin(roles, eq(workspaceMemberships.roleId, roles.id))
      .where(
        and(
          eq(workspaceMemberships.userId, userId),
          eq(workspaceMemberships.organizationId, organizationId),
          eq(workspaceMemberships.status, 'active'),
          eq(workspaces.status, 'active'),
        ),
      )
      .orderBy(asc(workspaces.name));
  }

  private issueSessionArtifacts(input: {
    activeWorkspaceId: string | null;
    familyId?: string;
    ipAddress: string | null;
    organizationId: string;
    sessionId?: string;
    userAgent: string | null;
    userId: string;
  }) {
    const now = new Date();
    const sessionId = input.sessionId ?? randomUUID();
    const refreshTokenId = randomUUID();
    const familyId = input.familyId ?? randomUUID();
    const accessToken = this.createToken('at');
    const refreshToken = this.createToken('rt');
    const sessionExpiresAt = this.addMinutes(
      now,
      this.configService.get('INTERNAL_AUTH_ACCESS_TOKEN_TTL_MINUTES', {
        infer: true,
      }),
    );
    const refreshExpiresAt = this.addDays(
      now,
      this.configService.get('INTERNAL_AUTH_REFRESH_TOKEN_TTL_DAYS', {
        infer: true,
      }),
    );

    return {
      accessToken,
      expiresAt: sessionExpiresAt,
      refreshToken,
      refreshTokenId,
      refreshTokenValues: {
        consumedAt: null,
        createdAt: now,
        expiresAt: refreshExpiresAt,
        familyId,
        id: refreshTokenId,
        replacedByTokenId: null,
        revokedAt: null,
        sessionId,
        tokenHash: this.hashToken(refreshToken),
        userId: input.userId,
      },
      sessionId,
      sessionValues: {
        accessTokenHash: this.hashToken(accessToken),
        activeWorkspaceId: input.activeWorkspaceId,
        createdAt: now,
        expiresAt: sessionExpiresAt,
        id: sessionId,
        ipAddress: input.ipAddress,
        lastSeenAt: now,
        organizationId: input.organizationId,
        revokedAt: null,
        updatedAt: now,
        userAgent: input.userAgent,
        userId: input.userId,
      },
    };
  }

  private serializeTokens(sessionArtifacts: {
    accessToken: string;
    expiresAt: Date;
  }) {
    return {
      accessToken: sessionArtifacts.accessToken,
      expiresAt: sessionArtifacts.expiresAt.toISOString(),
      tokenType: 'Bearer',
    };
  }

  private async revokeRefreshFamilyAndSession(input: {
    familyId?: string;
    revokedAt: Date;
    sessionId: string;
  }): Promise<void> {
    const db = this.getDatabase();

    await db.transaction(async (tx) => {
      const refreshWhereClause = input.familyId
        ? and(
            eq(refreshTokens.familyId, input.familyId),
            eq(refreshTokens.sessionId, input.sessionId),
            isNull(refreshTokens.revokedAt),
          )
        : and(
            eq(refreshTokens.sessionId, input.sessionId),
            isNull(refreshTokens.revokedAt),
          );

      await tx
        .update(refreshTokens)
        .set({
          revokedAt: input.revokedAt,
        })
        .where(refreshWhereClause);

      await tx
        .update(userSessions)
        .set({
          revokedAt: input.revokedAt,
          lastSeenAt: input.revokedAt,
          updatedAt: input.revokedAt,
        })
        .where(
          and(
            eq(userSessions.id, input.sessionId),
            isNull(userSessions.revokedAt),
          ),
        );
    });
  }

  private async recordRefreshReplayDetected(input: {
    familyId: string;
    reason: 'consumed' | 'revoked' | 'rotation_conflict';
    refreshTokenId: string;
    sessionId: string;
    userId: string;
  }): Promise<void> {
    await this.auditLogService.record({
      category: 'security',
      channel: 'api',
      action: AUDIT_ACTIONS.security.internalAuthSessionEnded,
      actorId: input.userId,
      actorType: 'user',
      authSurface: 'internal',
      metadata: {
        familyId: input.familyId,
        reason: input.reason,
        refreshReplayDetected: true,
      },
      resourceId: input.sessionId,
      resourceType: RESOURCE_TYPES.identity.userSession,
      sessionId: input.sessionId,
    });
  }

  private createToken(prefix: 'at' | 'rt' | 'inv' | 'pw' | 'ev'): string {
    return `swd_${prefix}_${randomBytes(24).toString('hex')}`;
  }

  private buildInviteUrl(token: string): string {
    const url = new URL(
      this.configService.get('INTERNAL_AUTH_INVITE_URL_BASE', { infer: true }),
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  private buildPasswordResetUrl(token: string): string {
    const url = new URL(
      this.configService.get('INTERNAL_AUTH_PASSWORD_RESET_URL_BASE', {
        infer: true,
      }),
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  private buildEmailVerificationUrl(token: string): string {
    const url = new URL(
      this.configService.get('INTERNAL_AUTH_EMAIL_VERIFICATION_URL_BASE', {
        infer: true,
      }),
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  private signPortalPayload(serializedPayload: string): string {
    return createHmac(
      'sha256',
      this.configService.get('PORTAL_AUTH_TOKEN_SECRET', { infer: true }),
    )
      .update(serializedPayload)
      .digest('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private readPortalTokenString(
    payload: Record<string, unknown>,
    key: string,
  ): string {
    const value = payload[key];

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new UnauthorizedException(
        'Portal access token is missing or invalid.',
      );
    }

    return value;
  }

  private readNullablePortalTokenString(
    payload: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = payload[key];

    if (value === null) {
      return null;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new UnauthorizedException(
        'Portal access token is missing or invalid.',
      );
    }

    return value;
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<boolean> {
    const [salt, expectedHash] = storedHash.split(':', 2);

    if (!salt || !expectedHash) {
      return false;
    }

    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (derivedKey.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, expectedBuffer);
  }

  private async getUserEmailVerificationState(userId: string) {
    const db = this.getDatabase();
    const identityRows = await db
      .select({ emailVerifiedAt: authIdentities.emailVerifiedAt })
      .from(authIdentities)
      .where(eq(authIdentities.userId, userId));

    const emailVerifiedAt = identityRows.reduce<Date | null>((latest, row) => {
      if (!row.emailVerifiedAt) {
        return latest;
      }

      if (!latest || row.emailVerifiedAt.getTime() > latest.getTime()) {
        return row.emailVerifiedAt;
      }

      return latest;
    }, null);

    return {
      emailVerifiedAt,
    };
  }

  public async resolveActiveOrganizationBySlug(organizationSlug: string) {
    const db = this.getDatabase();
    const [organization] = await db
      .select({
        displayName: organizations.displayName,
        id: organizations.id,
        slug: organizations.slug,
        status: organizations.status,
      })
      .from(organizations)
      .where(eq(organizations.slug, this.normalizeSlug(organizationSlug)))
      .limit(1);

    if (!organization || organization.status !== 'active') {
      throw new UnauthorizedException(
        'Google sign-in is not available for this organization.',
      );
    }

    return organization;
  }

  public async resolveActiveOrganizationById(organizationId: string) {
    const db = this.getDatabase();
    const [organization] = await db
      .select({
        displayName: organizations.displayName,
        id: organizations.id,
        slug: organizations.slug,
        status: organizations.status,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization || organization.status !== 'active') {
      throw new UnauthorizedException(
        'Google sign-in is not available for this organization.',
      );
    }

    return organization;
  }

  public async findUserByEmail(email: string) {
    const db = this.getDatabase();
    const [user] = await db
      .select({
        email: users.email,
        id: users.id,
        status: users.status,
      })
      .from(users)
      .where(eq(users.email, this.normalizeEmail(email)))
      .limit(1);

    return user ?? null;
  }

  public async findIdentityByProviderSubject(
    provider: 'google_oidc' | 'password',
    providerSubject: string,
  ) {
    const db = this.getDatabase();
    const [identity] = await db
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, provider),
          eq(authIdentities.providerSubject, providerSubject),
        ),
      )
      .limit(1);

    return identity ?? null;
  }

  public async findIdentityForUser(
    userId: string,
    provider: 'google_oidc' | 'password',
  ) {
    const db = this.getDatabase();
    const [identity] = await db
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.userId, userId),
          eq(authIdentities.provider, provider),
        ),
      )
      .limit(1);

    return identity ?? null;
  }

  public async resolveSingleActiveOrganizationForUser(userId: string) {
    return this.resolveSingleEligibleOrganizationForUser(userId, ['active']);
  }

  public async resolveSingleInviteEligibleOrganizationForUser(userId: string) {
    return this.resolveSingleEligibleOrganizationForUser(userId, [
      'active',
      'invited',
    ]);
  }

  public async listInviteEligibleMemberships(
    userId: string,
    organizationId: string,
  ) {
    const db = this.getDatabase();

    return db
      .select({
        membershipId: workspaceMemberships.id,
        status: workspaceMemberships.status,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
      })
      .from(workspaceMemberships)
      .innerJoin(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      )
      .where(
        and(
          eq(workspaceMemberships.userId, userId),
          eq(workspaceMemberships.organizationId, organizationId),
          inArray(workspaceMemberships.status, ['active', 'invited']),
          eq(workspaces.status, 'active'),
        ),
      )
      .orderBy(asc(workspaces.name));
  }

  private async resolveSingleEligibleOrganizationForUser(
    userId: string,
    membershipStatuses: Array<'active' | 'invited'>,
  ) {
    const db = this.getDatabase();
    const organizationRows = await db
      .select({
        displayName: organizations.displayName,
        id: organizations.id,
        slug: organizations.slug,
      })
      .from(workspaceMemberships)
      .innerJoin(
        organizations,
        eq(workspaceMemberships.organizationId, organizations.id),
      )
      .innerJoin(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      )
      .where(
        and(
          eq(workspaceMemberships.userId, userId),
          inArray(workspaceMemberships.status, membershipStatuses),
          eq(organizations.status, 'active'),
          eq(workspaces.status, 'active'),
        ),
      )
      .groupBy(organizations.id, organizations.slug, organizations.displayName)
      .orderBy(asc(organizations.displayName), asc(organizations.id))
      .limit(2);

    if (organizationRows.length === 0) {
      return null;
    }

    if (organizationRows.length > 1) {
      throw new ForbiddenException(
        'User belongs to multiple organizations. Continue from the invitation or workspace link for the correct organization.',
      );
    }

    return organizationRows[0];
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeSlug(value: string): string {
    return value.trim().toLowerCase();
  }

  private buildWorkspaceCode(
    organizationName: string,
    workspaceCode?: string,
  ): string {
    const normalizedWorkspaceCode = this.normalizeOptionalString(workspaceCode);

    if (normalizedWorkspaceCode) {
      const formattedWorkspaceCode = normalizedWorkspaceCode.toUpperCase();

      if (!WORKSPACE_CODE_PATTERN.test(formattedWorkspaceCode)) {
        throw new BadRequestException('Workspace code is invalid.');
      }

      return formattedWorkspaceCode;
    }

    return `${this.buildWorkspaceCodePrefix(organizationName)}-${this.generateWorkspaceCodeSuffix()}`;
  }

  private buildWorkspaceCodePrefix(value: string): string {
    const normalized = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '');

    const prefix = normalized.slice(0, WORKSPACE_CODE_PREFIX_LENGTH);

    return prefix.padEnd(WORKSPACE_CODE_PREFIX_LENGTH, 'X');
  }

  private generateWorkspaceCodeSuffix(): string {
    const randomValues = randomBytes(WORKSPACE_CODE_SUFFIX_LENGTH);

    return Array.from(
      randomValues,
      (value) =>
        WORKSPACE_CODE_SUFFIX_ALPHABET[
          value % WORKSPACE_CODE_SUFFIX_ALPHABET.length
        ],
    ).join('');
  }

  private normalizeOptionalString(
    value: string | undefined,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private addMinutes(source: Date, minutes: number): Date {
    return new Date(source.getTime() + minutes * 60_000);
  }

  private addHours(source: Date, hours: number): Date {
    return new Date(source.getTime() + hours * 60 * 60_000);
  }

  private addDays(source: Date, days: number): Date {
    return new Date(source.getTime() + days * 24 * 60 * 60_000);
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for auth operations.',
      );
    }

    return this.databaseService.db;
  }

  private rethrowConstraintViolation(error: unknown): void {
    if (!this.isUniqueViolation(error)) {
      return;
    }

    const constraint = this.getConstraintName(error);

    if (constraint === 'organizations_slug_key') {
      throw new BadRequestException('Organization slug is already in use.');
    }

    if (
      constraint === 'users_email_key' ||
      constraint === 'auth_identities_provider_subject_key'
    ) {
      throw new BadRequestException('Owner email is already registered.');
    }

    if (constraint === 'workspaces_org_code_key') {
      throw new BadRequestException(
        'Workspace code is already in use for this organization.',
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === '23505'
    );
  }

  private getConstraintName(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    return 'constraint' in error && typeof error.constraint === 'string'
      ? error.constraint
      : undefined;
  }
}
