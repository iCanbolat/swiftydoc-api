import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentActor } from '../auth/current-actor.decorator';
import type { AuthenticatedInternalActor } from '../auth/auth.types';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { OrganizationPermissions } from '../auth/organization-policy.decorator';
import { OrganizationPolicyGuard } from '../auth/organization-policy.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  UserInviteDispatchResponseDto,
  UserInviteRevocationResponseDto,
} from './dto/user-invite-response.dto';
import { UserListResponseDto, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({
  description: 'User does not have organization-level access to this resource.',
})
@UseGuards(InternalAuthGuard, OrganizationPolicyGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'List internal users for the current organization.',
  })
  @ApiOkResponse({ type: UserListResponseDto })
  @OrganizationPermissions('users.read')
  @Get()
  async listUsers(@CurrentActor() actor: AuthenticatedInternalActor) {
    return {
      data: await this.usersService.listUsers(actor.organization.id),
    };
  }

  @ApiOperation({
    summary: 'Create an invited internal user with workspace role assignments.',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('users.write')
  @Post()
  async createUser(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: CreateUserDto,
  ) {
    return {
      data: await this.usersService.createUser({
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        actorRoleNames: actor.roleNames,
        email: body.email,
        fullName: body.fullName,
        locale: body.locale,
        phone: body.phone,
        memberships: body.memberships,
      }),
    };
  }

  @ApiOperation({ summary: 'Get an internal user and workspace memberships.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @OrganizationPermissions('users.read')
  @Get(':id')
  async getUser(
    @Param('id') userId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    return {
      data: await this.usersService.getUser(userId, actor.organization.id),
    };
  }

  @ApiOperation({
    summary:
      'Update internal user profile, status, and workspace role assignments.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @OrganizationPermissions('users.write')
  @Patch(':id')
  async updateUser(
    @Param('id') userId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: UpdateUserDto,
  ) {
    return {
      data: await this.usersService.updateUser(userId, {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        actorRoleNames: actor.roleNames,
        fullName: body.fullName,
        locale: body.locale,
        phone: body.phone,
        status: body.status,
        memberships: body.memberships,
      }),
    };
  }

  @ApiOperation({
    summary: 'Resend onboarding invite email for an invited user.',
  })
  @ApiOkResponse({ type: UserInviteDispatchResponseDto })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @OrganizationPermissions('users.write')
  @Post(':id/resend-invite')
  async resendInvite(
    @Param('id') userId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    return {
      data: await this.usersService.resendInvite(userId, {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
      }),
    };
  }

  @ApiOperation({
    summary: 'Revoke outstanding onboarding invite tokens for an invited user.',
  })
  @ApiOkResponse({ type: UserInviteRevocationResponseDto })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @OrganizationPermissions('users.write')
  @Post(':id/revoke-invite')
  async revokeInvite(
    @Param('id') userId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    return {
      data: await this.usersService.revokeInvite(userId, {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
      }),
    };
  }
}
