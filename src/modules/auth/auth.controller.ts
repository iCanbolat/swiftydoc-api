import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
import { CurrentActor } from './current-actor.decorator';
import type { AuthenticatedInternalActor } from './auth.types';
import { AuthService } from './auth.service';
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
  InvitePreviewResponseDto,
  OrganizationEntitlementsResponseDto,
  PasswordResetCompletedResponseDto,
  PasswordResetRequestedResponseDto,
  SignOutResponseDto,
} from './dto/auth-response.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignInDto } from './dto/sign-in.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
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
  async bootstrapOwner(@Body() body: BootstrapOwnerDto) {
    const result = await this.authService.bootstrapOwner({
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

    return {
      data: result,
    };
  }

  @ApiOperation({
    summary: 'Sign in an internal user against a specific organization.',
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Credentials are invalid.' })
  @Post('sign-in')
  async signIn(@Body() body: SignInDto) {
    const result = await this.authService.signIn({
      email: body.email,
      organizationSlug: body.organizationSlug,
      password: body.password,
    });

    return {
      data: result,
    };
  }

  @ApiOperation({
    summary: 'Rotate an internal session using a refresh token.',
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiForbiddenResponse({
    description:
      'Email verification is required before continuing the session.',
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid.' })
  @Post('refresh')
  async refresh(@Body() body: RefreshSessionDto) {
    const result = await this.authService.refreshSession(body.refreshToken);

    return {
      data: result,
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
  @Post('complete-invite')
  async completeInvite(@Body() body: CompleteInviteDto) {
    return {
      data: await this.authService.completeInvite({
        token: body.token,
        password: body.password,
      }),
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
  @Post('sign-out')
  async signOut(@Headers('authorization') authorization?: string) {
    await this.authService.signOut(this.extractBearerToken(authorization));

    return {
      data: {
        signedOut: true,
      },
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
