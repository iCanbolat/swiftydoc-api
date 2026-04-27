import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull } from 'drizzle-orm';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import {
  authIdentities,
  passwordResetTokens,
  users,
  workspaceMemberships,
} from '../../infrastructure/database/schema';
import type { AuthenticatedInternalActor } from './auth.types';
import { AuthService } from './auth.service';
import {
  GoogleAuthStateTokenPayload,
  GoogleLinkPendingTokenPayload,
  GoogleOidcTokenResponse,
  GoogleOidcUserProfile,
  ResolvedGoogleOidcUserProfile,
} from './google-auth.types';

const WORKSPACE_CODE_PATTERN = /^[A-Z0-9]{3}-[A-Z]{5}$/;

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService<RuntimeEnv, true>,
    private readonly databaseService: DatabaseService,
  ) {}

  async startGoogleAuth(input: {
    inviteToken?: string;
    intent?: 'sign_in' | 'sign_up';
    legalName?: string;
    locale?: string;
    organizationName?: string;
    organizationSlug?: string;
    primaryRegion?: string;
    timezone?: string;
    workspaceCode?: string;
    workspaceName?: string;
  }) {
    const intent = input.intent ?? 'sign_in';

    if (intent === 'sign_up') {
      if (input.inviteToken) {
        throw new BadRequestException(
          'Invite token cannot be used with Google sign-up.',
        );
      }

      this.authService.assertBootstrapSignupEnabled();

      const organizationName = this.normalizeOptionalString(
        input.organizationName,
      );
      const workspaceName = this.normalizeOptionalString(input.workspaceName);
      const requestedOrganizationSlug = this.normalizeOptionalString(
        input.organizationSlug,
      );
      const workspaceCode = this.normalizeOptionalString(input.workspaceCode);

      if (!organizationName || !requestedOrganizationSlug || !workspaceName) {
        throw new BadRequestException(
          'Google sign-up requires organization and workspace details.',
        );
      }

      const organizationSlug = this.normalizeSlug(requestedOrganizationSlug);

      return {
        authorizationUrl: this.buildGoogleAuthorizationUrl({
          stateToken: this.createGoogleStateToken({
            intent: 'sign_up',
            legalName: this.normalizeOptionalString(input.legalName),
            locale: this.normalizeOptionalString(input.locale),
            organizationName,
            organizationSlug,
            primaryRegion: this.normalizeOptionalString(input.primaryRegion),
            timezone: this.normalizeOptionalString(input.timezone),
            workspaceCode: workspaceCode
              ? this.normalizeWorkspaceCode(workspaceCode)
              : undefined,
            workspaceName,
          }),
        }),
        organizationSlug,
        outcome: 'authorization_required',
      };
    }

    const requestedOrganizationSlug = this.normalizeOptionalString(
      input.organizationSlug,
    );

    if (input.inviteToken) {
      const inviteContext = await this.authService.resolveInviteToken(
        input.inviteToken,
      );

      if (
        requestedOrganizationSlug &&
        inviteContext.organization.slug !==
          this.normalizeSlug(requestedOrganizationSlug)
      ) {
        throw new BadRequestException(
          'Invite token does not match the requested organization.',
        );
      }

      return {
        authorizationUrl: this.buildGoogleAuthorizationUrl({
          stateToken: this.createGoogleStateToken({
            intent: 'sign_in',
            inviteToken: input.inviteToken,
            organizationId: inviteContext.organization.id,
            organizationSlug: inviteContext.organization.slug,
          }),
        }),
        organizationSlug: inviteContext.organization.slug,
        outcome: 'authorization_required',
      };
    }

    if (requestedOrganizationSlug) {
      const organization =
        await this.authService.resolveActiveOrganizationBySlug(
          this.normalizeSlug(requestedOrganizationSlug),
        );

      return {
        authorizationUrl: this.buildGoogleAuthorizationUrl({
          stateToken: this.createGoogleStateToken({
            intent: 'sign_in',
            organizationId: organization.id,
            organizationSlug: organization.slug,
          }),
        }),
        organizationSlug: organization.slug,
        outcome: 'authorization_required',
      };
    }

    return {
      authorizationUrl: this.buildGoogleAuthorizationUrl({
        stateToken: this.createGoogleStateToken({
          intent: 'sign_in',
        }),
      }),
      outcome: 'authorization_required',
    };
  }

  async completeGoogleCallback(input: {
    code?: string;
    error?: string;
    state?: string;
  }) {
    if (input.error) {
      throw new UnauthorizedException('Google sign-in could not be completed.');
    }

    if (!input.code || !input.state) {
      throw new BadRequestException(
        'Google callback is missing required query parameters.',
      );
    }

    const state = this.readGoogleStateToken(input.state);
    const accessToken = await this.exchangeGoogleAuthorizationCode(input.code);
    const googleProfile = await this.fetchGoogleUserProfile(accessToken);

    if (state.intent === 'link') {
      return this.completeGoogleLinkCallback(state, googleProfile);
    }

    if (state.intent === 'sign_up') {
      return this.completeGoogleBootstrapSignup(state, googleProfile);
    }

    return this.completeGoogleSignInCallback(state, googleProfile);
  }

  async linkGoogle(
    actor: AuthenticatedInternalActor,
    input: { linkToken?: string },
  ) {
    if (input.linkToken) {
      return this.completeGoogleLinkFromPendingToken(actor, input.linkToken);
    }

    const existingGoogleIdentity = await this.authService.findIdentityForUser(
      actor.user.id,
      'google_oidc',
    );

    if (existingGoogleIdentity) {
      throw new ConflictException('Google is already linked for this user.');
    }

    return {
      authorizationUrl: this.buildGoogleAuthorizationUrl({
        loginHint: actor.user.email,
        stateToken: this.createGoogleStateToken({
          intent: 'link',
          organizationId: actor.organization.id,
          organizationSlug: actor.organization.slug,
          sessionId: actor.session.id,
          userEmail: actor.user.email,
          userId: actor.user.id,
        }),
      }),
      organizationSlug: actor.organization.slug,
      outcome: 'authorization_required',
    };
  }

  async unlinkGoogle(actor: AuthenticatedInternalActor) {
    const db = this.getDatabase();
    const identities = await db
      .select({
        id: authIdentities.id,
        provider: authIdentities.provider,
      })
      .from(authIdentities)
      .where(eq(authIdentities.userId, actor.user.id));
    const googleIdentity = identities.find(
      (identity) => identity.provider === 'google_oidc',
    );

    if (!googleIdentity) {
      throw new NotFoundException('Google is not linked for this user.');
    }

    if (identities.length <= 1) {
      throw new ConflictException(
        'Cannot unlink the only available sign-in method.',
      );
    }

    await db
      .delete(authIdentities)
      .where(eq(authIdentities.id, googleIdentity.id));

    await this.auditLogService.record({
      category: 'security',
      channel: 'api',
      action: AUDIT_ACTIONS.security.internalAuthIdentityUnlinked,
      authSurface: 'internal',
      organizationId: actor.organization.id,
      actorId: actor.user.id,
      actorType: 'user',
      sessionId: actor.session.id,
      resourceType: RESOURCE_TYPES.identity.authIdentity,
      resourceId: googleIdentity.id,
      metadata: {
        provider: 'google_oidc',
      },
    });

    return {
      unlinked: true,
    };
  }

  private async completeGoogleSignInCallback(
    state: GoogleAuthStateTokenPayload,
    googleProfile: ResolvedGoogleOidcUserProfile,
  ) {
    if (!googleProfile.emailVerifiedAt) {
      throw new ForbiddenException(
        'Google account did not return a verified email address.',
      );
    }

    if (state.inviteToken) {
      const inviteContext = await this.authService.resolveInviteToken(
        state.inviteToken,
      );

      if (
        state.organizationId &&
        inviteContext.organization.id !== state.organizationId
      ) {
        throw new BadRequestException('Google sign-in state is invalid.');
      }

      const organization = inviteContext.organization;

      const linkedIdentity = await this.linkGoogleIdentityToUser({
        activateInvitedAccess: true,
        allowEmailMismatchWithUser: true,
        consumeInviteTokenId: inviteContext.token.id,
        emailVerifiedAt: googleProfile.emailVerifiedAt,
        googleEmail: googleProfile.email,
        googleSubject: googleProfile.subject,
        organizationId: organization.id,
        organizationSlug: organization.slug,
        userId: inviteContext.user.id,
      });
      const activeMemberships = await this.authService.listActiveMemberships(
        inviteContext.user.id,
        organization.id,
      );

      if (activeMemberships.length === 0) {
        throw new ForbiddenException(
          'User does not have an active workspace membership.',
        );
      }

      await this.auditLogService.record({
        category: 'security',
        channel: 'api',
        action: AUDIT_ACTIONS.security.internalAuthInviteCompleted,
        authSurface: 'internal',
        organizationId: organization.id,
        actorId: inviteContext.user.id,
        actorType: 'user',
        resourceType: RESOURCE_TYPES.identity.user,
        resourceId: inviteContext.user.id,
        metadata: {
          email: inviteContext.user.email,
          providerEmail: googleProfile.email,
        },
      });

      return this.authService.createInternalSessionForIdentity({
        activeWorkspaceId: activeMemberships[0].workspaceId,
        emailVerifiedAt: googleProfile.emailVerifiedAt,
        identityId: linkedIdentity.identityId,
        organizationId: organization.id,
        roleNames: [
          ...new Set(
            activeMemberships.map((membership) => membership.roleName),
          ),
        ],
        userId: inviteContext.user.id,
      });
    }

    const [linkedIdentityRecord] = await this.getDatabase()
      .select({
        identity: authIdentities,
        user: users,
      })
      .from(authIdentities)
      .innerJoin(users, eq(authIdentities.userId, users.id))
      .where(
        and(
          eq(authIdentities.provider, 'google_oidc'),
          eq(authIdentities.providerSubject, googleProfile.subject),
        ),
      )
      .limit(1);

    if (linkedIdentityRecord) {
      if (linkedIdentityRecord.user.status !== 'active') {
        throw new ForbiddenException('User account is not active.');
      }

      const organization = await this.resolveOrganizationForGoogleSignIn({
        fallbackMode: 'active',
        state,
        userId: linkedIdentityRecord.user.id,
      });

      if (!organization) {
        throw new UnauthorizedException(
          'Google sign-in is not available for this account.',
        );
      }

      const activeMemberships = await this.authService.listActiveMemberships(
        linkedIdentityRecord.user.id,
        organization.id,
      );

      if (activeMemberships.length === 0) {
        throw new ForbiddenException(
          'User does not have an active workspace membership.',
        );
      }

      return this.authService.createInternalSessionForIdentity({
        activeWorkspaceId: activeMemberships[0].workspaceId,
        emailVerifiedAt: googleProfile.emailVerifiedAt,
        identityId: linkedIdentityRecord.identity.id,
        organizationId: organization.id,
        roleNames: [
          ...new Set(
            activeMemberships.map((membership) => membership.roleName),
          ),
        ],
        userId: linkedIdentityRecord.user.id,
      });
    }

    const localUser = await this.authService.findUserByEmail(
      googleProfile.email,
    );

    if (!localUser) {
      throw new UnauthorizedException(
        'Google sign-in is not available for this organization.',
      );
    }

    if (localUser.status !== 'active' && localUser.status !== 'invited') {
      throw new ForbiddenException('User account is not active.');
    }

    const organization = await this.resolveOrganizationForGoogleSignIn({
      fallbackMode: 'invite_eligible',
      state,
      userId: localUser.id,
    });

    if (!organization) {
      throw new UnauthorizedException(
        'Google sign-in is not available for this account.',
      );
    }

    const inviteEligibleMemberships =
      await this.authService.listInviteEligibleMemberships(
        localUser.id,
        organization.id,
      );

    if (inviteEligibleMemberships.length === 0) {
      throw new UnauthorizedException(
        'Google sign-in is not available for this organization.',
      );
    }

    const passwordIdentity = await this.authService.findIdentityForUser(
      localUser.id,
      'password',
    );

    if (passwordIdentity) {
      return {
        email: localUser.email,
        linkToken: this.createGoogleLinkPendingToken({
          email: localUser.email,
          googleEmail: googleProfile.email,
          googleEmailVerified: true,
          googleSubject: googleProfile.subject,
          organizationId: organization.id,
          organizationSlug: organization.slug,
          userId: localUser.id,
        }),
        organizationSlug: organization.slug,
        outcome: 'link_required',
        providerEmail: googleProfile.email,
      };
    }

    const linkedIdentity = await this.linkGoogleIdentityToUser({
      activateInvitedAccess: true,
      emailVerifiedAt: googleProfile.emailVerifiedAt,
      googleEmail: googleProfile.email,
      googleSubject: googleProfile.subject,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      userId: localUser.id,
    });
    const activeMemberships = await this.authService.listActiveMemberships(
      localUser.id,
      organization.id,
    );

    if (activeMemberships.length === 0) {
      throw new ForbiddenException(
        'User does not have an active workspace membership.',
      );
    }

    return this.authService.createInternalSessionForIdentity({
      activeWorkspaceId: activeMemberships[0].workspaceId,
      emailVerifiedAt: googleProfile.emailVerifiedAt,
      identityId: linkedIdentity.identityId,
      organizationId: organization.id,
      roleNames: [
        ...new Set(activeMemberships.map((membership) => membership.roleName)),
      ],
      userId: localUser.id,
    });
  }

  private async completeGoogleBootstrapSignup(
    state: GoogleAuthStateTokenPayload,
    googleProfile: ResolvedGoogleOidcUserProfile,
  ) {
    this.authService.assertBootstrapSignupEnabled();

    if (!googleProfile.emailVerifiedAt) {
      throw new ForbiddenException(
        'Google account did not return a verified email address.',
      );
    }

    if (!state.organizationName || !state.workspaceName) {
      throw new BadRequestException('Google sign-up state is invalid.');
    }

    if (!state.organizationSlug) {
      throw new BadRequestException('Google sign-up state is invalid.');
    }

    const existingGoogleIdentity =
      await this.authService.findIdentityByProviderSubject(
        'google_oidc',
        googleProfile.subject,
      );

    if (existingGoogleIdentity) {
      throw new BadRequestException('Google account is already registered.');
    }

    const existingUser = await this.authService.findUserByEmail(
      googleProfile.email,
    );

    if (existingUser) {
      throw new BadRequestException('Owner email is already registered.');
    }

    const result = await this.authService.createBootstrappedOwnerSession({
      authIdentity: {
        emailVerifiedAt: googleProfile.emailVerifiedAt,
        provider: 'google_oidc',
        providerSubject: googleProfile.subject,
      },
      legalName: state.legalName,
      locale: state.locale,
      organizationName: state.organizationName,
      organizationSlug: state.organizationSlug,
      ownerEmail: googleProfile.email,
      ownerFullName: googleProfile.fullName,
      primaryRegion: state.primaryRegion,
      timezone: state.timezone,
      workspaceCode: state.workspaceCode,
      workspaceName: state.workspaceName,
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
        authProvider: 'google_oidc',
        organizationSlug: result.organization.slug,
      },
    });

    const actor = await this.authService.getCurrentActor(
      result.sessionArtifacts.accessToken,
    );

    return {
      actor,
      outcome: 'signed_in',
      refreshToken: result.sessionArtifacts.refreshToken,
      tokens: this.serializeTokens(result.sessionArtifacts),
    };
  }

  private async completeGoogleLinkCallback(
    state: GoogleAuthStateTokenPayload,
    googleProfile: ResolvedGoogleOidcUserProfile,
  ) {
    if (!state.organizationId || !state.userId || !state.userEmail) {
      throw new BadRequestException('Google link state is invalid.');
    }

    const organization = await this.authService.resolveActiveOrganizationById(
      state.organizationId,
    );

    await this.linkGoogleIdentityToUser({
      actorUserId: state.userId,
      emailVerifiedAt: googleProfile.emailVerifiedAt,
      expectedLocalEmail: state.userEmail,
      googleEmail: googleProfile.email,
      googleSubject: googleProfile.subject,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      sessionId: state.sessionId ?? null,
      userId: state.userId,
    });

    return {
      email: state.userEmail,
      linked: true,
      organizationSlug: organization.slug,
      outcome: 'linked',
      providerEmail: googleProfile.email,
    };
  }

  private async completeGoogleLinkFromPendingToken(
    actor: AuthenticatedInternalActor,
    linkToken: string,
  ) {
    const pendingLink = this.readGoogleLinkPendingToken(linkToken);

    if (
      pendingLink.userId !== actor.user.id ||
      pendingLink.organizationId !== actor.organization.id
    ) {
      throw new ForbiddenException(
        'Google link token does not match the authenticated user.',
      );
    }

    await this.linkGoogleIdentityToUser({
      actorUserId: actor.user.id,
      emailVerifiedAt: pendingLink.googleEmailVerified ? new Date() : null,
      expectedLocalEmail: pendingLink.email,
      googleEmail: pendingLink.googleEmail,
      googleSubject: pendingLink.googleSubject,
      organizationId: actor.organization.id,
      organizationSlug: actor.organization.slug,
      sessionId: actor.session.id,
      userId: actor.user.id,
    });

    return {
      email: actor.user.email,
      linked: true,
      organizationSlug: actor.organization.slug,
      outcome: 'linked',
      providerEmail: pendingLink.googleEmail,
    };
  }

  private async resolveOrganizationForGoogleSignIn(input: {
    fallbackMode: 'active' | 'invite_eligible';
    state: GoogleAuthStateTokenPayload;
    userId: string;
  }) {
    if (input.state.organizationId) {
      return this.authService.resolveActiveOrganizationById(
        input.state.organizationId,
      );
    }

    return input.fallbackMode === 'active'
      ? this.authService.resolveSingleActiveOrganizationForUser(input.userId)
      : this.authService.resolveSingleInviteEligibleOrganizationForUser(
          input.userId,
        );
  }

  private async linkGoogleIdentityToUser(input: {
    activateInvitedAccess?: boolean;
    allowEmailMismatchWithUser?: boolean;
    actorUserId?: string;
    consumeInviteTokenId?: string;
    emailVerifiedAt: Date | null;
    expectedLocalEmail?: string;
    googleEmail: string;
    googleSubject: string;
    organizationId: string;
    organizationSlug: string;
    sessionId?: string | null;
    userId: string;
  }) {
    if (!input.emailVerifiedAt) {
      throw new ForbiddenException(
        'Google account did not return a verified email address.',
      );
    }

    const normalizedGoogleEmail = this.normalizeEmail(input.googleEmail);

    if (
      input.expectedLocalEmail &&
      normalizedGoogleEmail !== this.normalizeEmail(input.expectedLocalEmail)
    ) {
      throw new ConflictException(
        'Google account email does not match the current user email.',
      );
    }

    const db = this.getDatabase();
    const [user] = await db
      .select({
        email: users.email,
        id: users.id,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.status !== 'active' && user.status !== 'invited') {
      throw new ForbiddenException('User account is not active.');
    }

    if (
      !input.allowEmailMismatchWithUser &&
      normalizedGoogleEmail !== this.normalizeEmail(user.email)
    ) {
      throw new ConflictException(
        'Google account email does not match the current user email.',
      );
    }

    const inviteEligibleMemberships =
      await this.authService.listInviteEligibleMemberships(
        input.userId,
        input.organizationId,
      );

    if (inviteEligibleMemberships.length === 0) {
      throw new ForbiddenException(
        'User does not have invite-eligible workspace memberships.',
      );
    }

    const existingIdentityBySubject =
      await this.authService.findIdentityByProviderSubject(
        'google_oidc',
        input.googleSubject,
      );

    if (
      existingIdentityBySubject &&
      existingIdentityBySubject.userId !== input.userId
    ) {
      throw new ConflictException(
        'Google account is already linked to another user.',
      );
    }

    const existingIdentityForUser = await this.authService.findIdentityForUser(
      input.userId,
      'google_oidc',
    );

    if (
      existingIdentityForUser &&
      existingIdentityForUser.providerSubject !== input.googleSubject
    ) {
      throw new ConflictException(
        'A different Google account is already linked for this user.',
      );
    }

    const now = new Date();
    const identityId =
      existingIdentityBySubject?.id ??
      existingIdentityForUser?.id ??
      randomUUID();
    const created = !existingIdentityBySubject && !existingIdentityForUser;

    await db.transaction(async (tx) => {
      const googleIdentityValues = {
        emailVerifiedAt: input.emailVerifiedAt,
        lastAuthenticatedAt: now,
        providerSubject: input.googleSubject,
        updatedAt: now,
      };

      if (existingIdentityBySubject) {
        await tx
          .update(authIdentities)
          .set(googleIdentityValues)
          .where(eq(authIdentities.id, existingIdentityBySubject.id));
      } else if (existingIdentityForUser) {
        await tx
          .update(authIdentities)
          .set(googleIdentityValues)
          .where(eq(authIdentities.id, existingIdentityForUser.id));
      } else {
        await tx.insert(authIdentities).values({
          createdAt: now,
          emailVerifiedAt: input.emailVerifiedAt,
          id: identityId,
          lastAuthenticatedAt: now,
          provider: 'google_oidc',
          providerSubject: input.googleSubject,
          updatedAt: now,
          userId: input.userId,
        });
      }

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

      if (input.consumeInviteTokenId) {
        const consumedInviteTokens = await tx
          .update(passwordResetTokens)
          .set({ consumedAt: now })
          .where(
            and(
              eq(passwordResetTokens.id, input.consumeInviteTokenId),
              isNull(passwordResetTokens.consumedAt),
            ),
          )
          .returning({ id: passwordResetTokens.id });

        if (consumedInviteTokens.length === 0) {
          throw new UnauthorizedException(
            'Invite token is invalid or expired.',
          );
        }
      }

      if (input.activateInvitedAccess) {
        await tx
          .update(users)
          .set({
            status: 'active',
          })
          .where(and(eq(users.id, input.userId), eq(users.status, 'invited')));

        await tx
          .update(workspaceMemberships)
          .set({
            status: 'active',
          })
          .where(
            and(
              eq(workspaceMemberships.userId, input.userId),
              eq(workspaceMemberships.organizationId, input.organizationId),
              eq(workspaceMemberships.status, 'invited'),
            ),
          );
      }
    });

    if (created) {
      await this.auditLogService.record({
        category: 'security',
        channel: 'api',
        action: AUDIT_ACTIONS.security.internalAuthIdentityLinked,
        authSurface: 'internal',
        organizationId: input.organizationId,
        actorId: input.actorUserId ?? input.userId,
        actorType: 'user',
        sessionId: input.sessionId ?? undefined,
        resourceType: RESOURCE_TYPES.identity.authIdentity,
        resourceId: identityId,
        metadata: {
          organizationSlug: input.organizationSlug,
          provider: 'google_oidc',
          providerEmail: normalizedGoogleEmail,
        },
      });
    }

    return {
      created,
      identityId,
    };
  }

  private async findGoogleIdentityBySubject(subject: string) {
    const db = this.getDatabase();
    const [identity] = await db
      .select({
        id: authIdentities.id,
        userId: authIdentities.userId,
      })
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, 'google_oidc'),
          eq(authIdentities.providerSubject, subject),
        ),
      )
      .limit(1);

    if (!identity) {
      return null;
    }

    const [user] = await db
      .select({
        id: users.id,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, identity.userId))
      .limit(1);

    if (!user) {
      return null;
    }

    return {
      identity,
      user,
    };
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for auth operations.',
      );
    }

    return this.databaseService.db;
  }

  private buildGoogleAuthorizationUrl(input: {
    loginHint?: string;
    stateToken: string;
  }) {
    const config = this.getGoogleOidcConfig();
    const url = new URL(config.authUrl);

    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.scope);
    url.searchParams.set('state', input.stateToken);
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set('include_granted_scopes', 'true');

    if (input.loginHint) {
      url.searchParams.set('login_hint', input.loginHint);
    }

    return url.toString();
  }

  private createGoogleStateToken(input: {
    intent: GoogleAuthStateTokenPayload['intent'];
    inviteToken?: string;
    organizationId?: string;
    organizationName?: string;
    organizationSlug?: string;
    legalName?: string;
    locale?: string;
    primaryRegion?: string;
    sessionId?: string;
    timezone?: string;
    userEmail?: string;
    userId?: string;
    workspaceCode?: string;
    workspaceName?: string;
  }): string {
    const issuedAt = new Date();
    const expiresAt = this.addMinutes(
      issuedAt,
      this.configService.get('INTERNAL_AUTH_GOOGLE_STATE_TTL_MINUTES', {
        infer: true,
      }),
    );

    return this.createSignedGoogleToken('gs', {
      exp: expiresAt.toISOString(),
      iat: issuedAt.toISOString(),
      intent: input.intent,
      inviteToken: input.inviteToken,
      organizationId: input.organizationId,
      organizationName: input.organizationName,
      organizationSlug: input.organizationSlug,
      legalName: input.legalName,
      locale: input.locale,
      primaryRegion: input.primaryRegion,
      sessionId: input.sessionId,
      type: 'google_state',
      timezone: input.timezone,
      userEmail: input.userEmail,
      userId: input.userId,
      workspaceCode: input.workspaceCode,
      workspaceName: input.workspaceName,
    });
  }

  private readGoogleStateToken(token: string): GoogleAuthStateTokenPayload {
    const payload = this.readSignedGoogleToken(
      token,
      'gs',
      'Google sign-in state is missing or invalid.',
    );
    const intent = this.readTokenString(payload, 'intent');

    if (intent !== 'link' && intent !== 'sign_in' && intent !== 'sign_up') {
      throw new UnauthorizedException(
        'Google sign-in state is missing or invalid.',
      );
    }

    return {
      exp: this.readTokenString(payload, 'exp'),
      iat: this.readTokenString(payload, 'iat'),
      intent,
      inviteToken: this.readOptionalTokenString(payload, 'inviteToken'),
      organizationId: this.readOptionalTokenString(payload, 'organizationId'),
      organizationName: this.readOptionalTokenString(
        payload,
        'organizationName',
      ),
      organizationSlug: this.readOptionalTokenString(
        payload,
        'organizationSlug',
      ),
      legalName: this.readOptionalTokenString(payload, 'legalName'),
      locale: this.readOptionalTokenString(payload, 'locale'),
      primaryRegion: this.readOptionalTokenString(payload, 'primaryRegion'),
      sessionId: this.readOptionalTokenString(payload, 'sessionId'),
      type: 'google_state',
      timezone: this.readOptionalTokenString(payload, 'timezone'),
      userEmail: this.readOptionalTokenString(payload, 'userEmail'),
      userId: this.readOptionalTokenString(payload, 'userId'),
      workspaceCode: this.readOptionalTokenString(payload, 'workspaceCode'),
      workspaceName: this.readOptionalTokenString(payload, 'workspaceName'),
    };
  }

  private createGoogleLinkPendingToken(input: {
    email: string;
    googleEmail: string;
    googleEmailVerified: boolean;
    googleSubject: string;
    organizationId: string;
    organizationSlug: string;
    userId: string;
  }): string {
    const issuedAt = new Date();
    const expiresAt = this.addMinutes(
      issuedAt,
      this.configService.get('INTERNAL_AUTH_GOOGLE_STATE_TTL_MINUTES', {
        infer: true,
      }),
    );

    return this.createSignedGoogleToken('gl', {
      email: input.email,
      exp: expiresAt.toISOString(),
      googleEmail: input.googleEmail,
      googleEmailVerified: input.googleEmailVerified,
      googleSubject: input.googleSubject,
      iat: issuedAt.toISOString(),
      organizationId: input.organizationId,
      organizationSlug: input.organizationSlug,
      type: 'google_link_pending',
      userId: input.userId,
    });
  }

  private readGoogleLinkPendingToken(
    token: string,
  ): GoogleLinkPendingTokenPayload {
    const payload = this.readSignedGoogleToken(
      token,
      'gl',
      'Google link token is missing or invalid.',
    );
    const googleEmailVerified = payload.googleEmailVerified;

    if (typeof googleEmailVerified !== 'boolean') {
      throw new UnauthorizedException(
        'Google link token is missing or invalid.',
      );
    }

    return {
      email: this.readTokenString(payload, 'email'),
      exp: this.readTokenString(payload, 'exp'),
      googleEmail: this.readTokenString(payload, 'googleEmail'),
      googleEmailVerified,
      googleSubject: this.readTokenString(payload, 'googleSubject'),
      iat: this.readTokenString(payload, 'iat'),
      organizationId: this.readTokenString(payload, 'organizationId'),
      organizationSlug: this.readTokenString(payload, 'organizationSlug'),
      type: 'google_link_pending',
      userId: this.readTokenString(payload, 'userId'),
    };
  }

  private createSignedGoogleToken(
    prefix: 'gl' | 'gs',
    payload: GoogleAuthStateTokenPayload | GoogleLinkPendingTokenPayload,
  ): string {
    const serializedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );

    return `swd_${prefix}_${serializedPayload}.${this.signGooglePayload(serializedPayload)}`;
  }

  private readSignedGoogleToken(
    token: string,
    prefix: 'gl' | 'gs',
    invalidMessage: string,
  ): Record<string, unknown> {
    const tokenPrefix = `swd_${prefix}_`;
    const tokenBody = token.startsWith(tokenPrefix)
      ? token.slice(tokenPrefix.length)
      : null;

    if (!tokenBody) {
      throw new UnauthorizedException(invalidMessage);
    }

    const [serializedPayload, signature] = tokenBody.split('.', 2);

    if (!serializedPayload || !signature) {
      throw new UnauthorizedException(invalidMessage);
    }

    const expectedSignature = this.signGooglePayload(serializedPayload);
    const actualBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException(invalidMessage);
    }

    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(
        Buffer.from(serializedPayload, 'base64url').toString('utf8'),
      ) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException(invalidMessage);
    }

    const expiresAt = this.readTokenString(payload, 'exp');
    const parsedExpiresAt = new Date(expiresAt);

    if (
      Number.isNaN(parsedExpiresAt.getTime()) ||
      parsedExpiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(invalidMessage);
    }

    return payload;
  }

  private signGooglePayload(serializedPayload: string): string {
    return createHmac(
      'sha256',
      this.configService.get('INTERNAL_AUTH_GOOGLE_STATE_SECRET', {
        infer: true,
      }),
    )
      .update(serializedPayload)
      .digest('base64url');
  }

  private async exchangeGoogleAuthorizationCode(code: string): Promise<string> {
    const config = this.getGoogleOidcConfig();
    let response: Response;

    try {
      response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri,
        }),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Google sign-in is temporarily unavailable.',
      );
    }

    const payload =
      await this.parseJsonResponse<GoogleOidcTokenResponse>(response);

    if (!response.ok || !payload?.access_token) {
      throw new UnauthorizedException('Google sign-in could not be completed.');
    }

    return payload.access_token;
  }

  private async fetchGoogleUserProfile(
    accessToken: string,
  ): Promise<ResolvedGoogleOidcUserProfile> {
    const config = this.getGoogleOidcConfig();
    let response: Response;

    try {
      response = await fetch(config.userInfoUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Google sign-in is temporarily unavailable.',
      );
    }

    const payload =
      await this.parseJsonResponse<GoogleOidcUserProfile>(response);

    if (!response.ok || !payload) {
      throw new UnauthorizedException('Google sign-in could not be completed.');
    }

    return this.normalizeGoogleUserProfile(payload);
  }

  private normalizeGoogleUserProfile(
    profile: GoogleOidcUserProfile,
  ): ResolvedGoogleOidcUserProfile {
    if (typeof profile.sub !== 'string' || profile.sub.trim().length === 0) {
      throw new UnauthorizedException('Google sign-in could not be completed.');
    }

    if (
      typeof profile.email !== 'string' ||
      profile.email.trim().length === 0
    ) {
      throw new UnauthorizedException('Google sign-in could not be completed.');
    }

    const normalizedEmail = this.normalizeEmail(profile.email);

    return {
      email: normalizedEmail,
      emailVerifiedAt: profile.email_verified === true ? new Date() : null,
      fullName:
        typeof profile.name === 'string' && profile.name.trim().length > 0
          ? profile.name.trim()
          : normalizedEmail,
      subject: profile.sub.trim(),
    };
  }

  private getGoogleOidcConfig() {
    const clientId = this.configService.get('GOOGLE_OIDC_CLIENT_ID', {
      infer: true,
    });
    const clientSecret = this.configService.get('GOOGLE_OIDC_CLIENT_SECRET', {
      infer: true,
    });
    const redirectUri = this.configService.get('GOOGLE_OIDC_REDIRECT_URI', {
      infer: true,
    });

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Google OIDC is not configured.');
    }

    return {
      authUrl: this.configService.get('GOOGLE_OIDC_AUTH_URL', { infer: true }),
      clientId,
      clientSecret,
      redirectUri,
      scope: this.configService.get('GOOGLE_OIDC_SCOPE', { infer: true }),
      tokenUrl: this.configService.get('GOOGLE_OIDC_TOKEN_URL', {
        infer: true,
      }),
      userInfoUrl: this.configService.get('GOOGLE_OIDC_USERINFO_URL', {
        infer: true,
      }),
    };
  }

  private async parseJsonResponse<T>(response: Response): Promise<T | null> {
    const responseText = await response.text();

    if (responseText.trim().length === 0) {
      return null;
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      return null;
    }
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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeSlug(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeWorkspaceCode(value: string): string {
    const normalized = value.trim().toUpperCase();

    if (!WORKSPACE_CODE_PATTERN.test(normalized)) {
      throw new BadRequestException('Workspace code is invalid.');
    }

    return normalized;
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

  private readTokenString(
    payload: Record<string, unknown>,
    key: string,
  ): string {
    const value = payload[key];

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new UnauthorizedException(
        'Signed auth token is missing or invalid.',
      );
    }

    return value;
  }

  private readOptionalTokenString(
    payload: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = payload[key];

    if (typeof value === 'undefined') {
      return undefined;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new UnauthorizedException(
        'Signed auth token is missing or invalid.',
      );
    }

    return value;
  }
}
