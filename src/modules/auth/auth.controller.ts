import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import {
  parseOriginList,
  type RuntimeEnv,
} from '../../common/config/runtime-env';
import { CurrentActor } from './current-actor.decorator';
import type { AuthenticatedInternalActor } from './auth.types';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { OrganizationEntitlementsService } from './organization-entitlements.service';
import { InternalAuthGuard } from './internal-auth.guard';
import { OrganizationPermissions } from './organization-policy.decorator';
import { OrganizationPolicyGuard } from './organization-policy.guard';
import { BootstrapOwnerDto } from './dto/bootstrap-owner.dto';
import { CompleteInviteDto } from './dto/complete-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import {
  AuthSessionResponseDto,
  CurrentActorResponseDto,
  EmailVerificationCompletedResponseDto,
  EmailVerificationRequestedResponseDto,
  GoogleAuthFlowResponseDto,
  GoogleUnlinkResponseDto,
  InvitePreviewResponseDto,
  OrganizationEntitlementsResponseDto,
  PasswordResetCompletedResponseDto,
  PasswordResetRequestedResponseDto,
  SignOutResponseDto,
} from './dto/auth-response.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignInDto } from './dto/sign-in.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  GoogleAuthCallbackQueryDto,
  LinkGoogleDto,
  StartGoogleAuthQueryDto,
} from './dto/google-auth.dto';

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<RuntimeEnv, true>,
    private readonly googleAuthService: GoogleAuthService,
    private readonly organizationEntitlementsService: OrganizationEntitlementsService,
  ) {}

  @ApiOperation({
    summary:
      'Create a new organization, seed minimum roles, and start a limited owner session pending email verification.',
  })
  @ApiCreatedResponse({ type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiForbiddenResponse({ description: 'Bootstrap signup is disabled.' })
  @Post('bootstrap-owner')
  async bootstrapOwner(
    @Body() body: BootstrapOwnerDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken, ...sessionData } =
      await this.authService.bootstrapOwner({
        legalName: body.legalName,
        locale: body.locale,
        organizationName: body.organizationName,
        organizationSlug: body.organizationSlug,
        ownerEmail: body.ownerEmail,
        ownerFullName: body.ownerFullName,
        password: body.password,
        phone: body.phone,
        primaryRegion: body.primaryRegion,
        timezone: body.timezone,
        workspaceCode: body.workspaceCode,
        workspaceName: body.workspaceName,
      });

    this.setRefreshCookie(response, refreshToken);

    return {
      data: sessionData,
    };
  }

  @ApiOperation({
    summary: 'Sign in an internal user with email and password.',
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Credentials are invalid.' })
  @HttpCode(200)
  @Post('sign-in')
  async signIn(
    @Body() body: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken, ...sessionData } = await this.authService.signIn({
      email: body.email,
      password: body.password,
    });

    this.setRefreshCookie(response, refreshToken);

    return {
      data: sessionData,
    };
  }

  @ApiOperation({
    summary:
      'Build the Google OIDC authorization URL for internal sign-in or self-serve owner sign-up.',
  })
  @ApiOkResponse({ type: GoogleAuthFlowResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiForbiddenResponse({ description: 'Bootstrap signup is disabled.' })
  @ApiUnauthorizedResponse({
    description: 'Google sign-in is not available for this organization.',
  })
  @Get('google/start')
  async startGoogleAuth(@Query() query: StartGoogleAuthQueryDto) {
    return {
      data: await this.googleAuthService.startGoogleAuth({
        inviteToken: query.inviteToken,
        intent: query.intent,
        legalName: query.legalName,
        locale: query.locale,
        organizationName: query.organizationName,
        organizationSlug: query.organizationSlug,
        primaryRegion: query.primaryRegion,
        timezone: query.timezone,
        workspaceCode: query.workspaceCode,
        workspaceName: query.workspaceName,
      }),
    };
  }

  @ApiOperation({
    summary:
      'Complete the Google OIDC callback and continue internal auth or linking.',
  })
  @ApiOkResponse({ type: GoogleAuthFlowResponseDto })
  @ApiBadRequestResponse({ description: 'Google callback query is invalid.' })
  @ApiUnauthorizedResponse({
    description: 'Google sign-in could not be completed.',
  })
  @Get('google/callback')
  async completeGoogleCallback(
    @Query() query: GoogleAuthCallbackQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.googleAuthService.completeGoogleCallback({
      code: query.code,
      error: query.error,
      state: query.state,
    });

    if (this.hasRefreshToken(result)) {
      const { refreshToken, ...responseData } = result;
      this.setRefreshCookie(response, refreshToken);

      return {
        data: responseData,
      };
    }

    return {
      data: result,
    };
  }

  @ApiOperation({
    summary: 'Rotate an internal session using a refresh token.',
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid refresh request.' })
  @ApiForbiddenResponse({
    description:
      'Email verification is required before continuing the session.',
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid.' })
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('origin') origin?: string,
  ) {
    const refreshToken = this.extractRefreshTokenFromCookie(request);
    this.assertAllowedOrigin(origin);

    const { refreshToken: rotatedRefreshToken, ...sessionData } =
      await this.authService.refreshSession(refreshToken);

    this.setRefreshCookie(response, rotatedRefreshToken);

    return {
      data: sessionData,
    };
  }

  @ApiOperation({
    summary: 'Resolve the authenticated internal actor from a bearer token.',
  })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: CurrentActorResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @Get('me')
  async getCurrentActor(@Headers('authorization') authorization?: string) {
    const actor = await this.authService.getCurrentActor(
      this.extractBearerToken(authorization),
    );

    return {
      data: {
        actor,
      },
    };
  }

  @ApiOperation({
    summary:
      'Request a fresh email verification link for the current internal user.',
  })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: EmailVerificationRequestedResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @UseGuards(InternalAuthGuard)
  @Post('me/request-email-verification')
  async requestEmailVerification(
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    return {
      data: await this.authService.issueEmailVerification({
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        userId: actor.user.id,
      }),
    };
  }

  @ApiOperation({
    summary:
      'Start Google linking from settings or finalize a pending Google link token for the authenticated internal user.',
  })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: GoogleAuthFlowResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @UseGuards(InternalAuthGuard)
  @Post('me/link-google')
  async linkGoogle(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body?: LinkGoogleDto,
  ) {
    return {
      data: await this.googleAuthService.linkGoogle(actor, {
        linkToken: body?.linkToken,
      }),
    };
  }

  @ApiOperation({
    summary:
      'Unlink the Google OIDC identity from the authenticated internal user.',
  })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: GoogleUnlinkResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @UseGuards(InternalAuthGuard)
  @Post('me/unlink-google')
  async unlinkGoogle(@CurrentActor() actor: AuthenticatedInternalActor) {
    return {
      data: await this.googleAuthService.unlinkGoogle(actor),
    };
  }

  @ApiOperation({
    summary: 'Resolve invite token details for onboarding UI.',
  })
  @ApiOkResponse({ type: InvitePreviewResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Invite token is invalid or expired.',
  })
  @Get('invites/:token')
  async getInvitePreview(@Param('token') token: string) {
    return {
      data: await this.authService.getInvitePreview(token),
    };
  }

  @ApiOperation({
    summary: 'Set password for an invited internal user and start a session.',
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Invite token is invalid or expired.',
  })
  @HttpCode(200)
  @Post('complete-invite')
  async completeInvite(
    @Body() body: CompleteInviteDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken, ...sessionData } =
      await this.authService.completeInvite({
        token: body.token,
        password: body.password,
      });

    this.setRefreshCookie(response, refreshToken);

    return {
      data: sessionData,
    };
  }

  @ApiOperation({
    summary: 'Request a password reset email for an active internal user.',
  })
  @ApiOkResponse({ type: PasswordResetRequestedResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return {
      data: await this.authService.requestPasswordReset({
        organizationSlug: body.organizationSlug,
        email: body.email,
      }),
    };
  }

  @ApiOperation({
    summary: 'Reset password using a valid email token.',
  })
  @ApiOkResponse({ type: PasswordResetCompletedResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Password reset token is invalid or expired.',
  })
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return {
      data: await this.authService.resetPassword({
        token: body.token,
        password: body.password,
      }),
    };
  }

  @ApiOperation({ summary: 'Verify a user email with a valid token.' })
  @ApiOkResponse({ type: EmailVerificationCompletedResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Email verification token is invalid or expired.',
  })
  @Post('verify-email')
  async verifyEmail(@Body() body: VerifyEmailDto) {
    return {
      data: await this.authService.verifyEmail({
        token: body.token,
      }),
    };
  }

  @ApiOperation({
    summary: 'Resolve current organization entitlement limits and usage.',
  })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: OrganizationEntitlementsResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description:
      'User does not have organization-level access to this resource.',
  })
  @UseGuards(InternalAuthGuard, OrganizationPolicyGuard)
  @OrganizationPermissions('organization.settings.read', 'billing.read')
  @Get('me/entitlements')
  async getOrganizationEntitlements(
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    const snapshot = await this.organizationEntitlementsService.getSnapshot(
      actor.organization.id,
    );

    return {
      data: snapshot,
    };
  }

  @ApiOperation({ summary: 'Revoke the current internal session.' })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: SignOutResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @HttpCode(200)
  @Post('sign-out')
  async signOut(
    @Res({ passthrough: true }) response: Response,
    @Headers('authorization') authorization?: string,
    @Headers('origin') origin?: string,
  ) {
    const accessToken = this.extractBearerToken(authorization);
    this.assertAllowedOrigin(origin);

    try {
      await this.authService.signOut(accessToken);
    } finally {
      this.clearRefreshCookie(response);
    }

    return {
      data: {
        signedOut: true,
      },
    };
  }

  private hasRefreshToken(
    payload: unknown,
  ): payload is { refreshToken: string } {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }

    const candidate = payload as { refreshToken?: unknown };
    return typeof candidate.refreshToken === 'string';
  }

  private extractRefreshTokenFromCookie(request: Request): string {
    const refreshToken = request.cookies?.[this.getRefreshCookieName()];

    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new UnauthorizedException('Refresh token is invalid.');
    }

    return refreshToken;
  }

  private assertAllowedOrigin(origin?: string): void {
    const normalizedOrigin = origin?.trim();

    if (!normalizedOrigin) {
      throw new ForbiddenException('Origin header is required.');
    }

    const allowedOrigins = parseOriginList(
      this.configService.get('INTERNAL_AUTH_ALLOWED_ORIGINS', {
        infer: true,
      }),
    );

    if (!allowedOrigins.includes(normalizedOrigin)) {
      throw new ForbiddenException('Origin is not allowed.');
    }
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(
      this.getRefreshCookieName(),
      refreshToken,
      this.getRefreshCookieOptions(),
    );
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(
      this.getRefreshCookieName(),
      this.getRefreshCookieBaseOptions(),
    );
  }

  private getRefreshCookieName(): string {
    return this.configService.get('INTERNAL_AUTH_REFRESH_COOKIE_NAME', {
      infer: true,
    });
  }

  private getRefreshCookieOptions(): CookieOptions {
    const maxAgeSeconds =
      this.configService.get('INTERNAL_AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS', {
        infer: true,
      }) ??
      this.configService.get('INTERNAL_AUTH_REFRESH_TOKEN_TTL_DAYS', {
        infer: true,
      }) *
        24 *
        60 *
        60;

    return {
      ...this.getRefreshCookieBaseOptions(),
      maxAge: maxAgeSeconds * 1000,
    };
  }

  private getRefreshCookieBaseOptions(): CookieOptions {
    const secureOverride = this.configService.get(
      'INTERNAL_AUTH_REFRESH_COOKIE_SECURE',
      {
        infer: true,
      },
    );
    const cookieDomain = this.configService.get(
      'INTERNAL_AUTH_REFRESH_COOKIE_DOMAIN',
      {
        infer: true,
      },
    );

    return {
      domain: cookieDomain,
      httpOnly: true,
      path: this.configService.get('INTERNAL_AUTH_REFRESH_COOKIE_PATH', {
        infer: true,
      }),
      sameSite: this.configService.get(
        'INTERNAL_AUTH_REFRESH_COOKIE_SAME_SITE',
        {
          infer: true,
        },
      ),
      secure:
        secureOverride ??
        this.configService.get('NODE_ENV', { infer: true }) === 'production',
    };
  }

  private extractBearerToken(authorization?: string): string {
    if (!authorization) {
      throw new UnauthorizedException('Bearer token is missing or invalid.');
    }

    const [scheme, token] = authorization.trim().split(/\s+/, 2);

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Bearer token is missing or invalid.');
    }

    return token;
  }
}
