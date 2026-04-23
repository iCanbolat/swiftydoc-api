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
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import {
  WorkspaceListResponseDto,
  WorkspaceResponseDto,
} from './dto/workspace-response.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('Workspaces')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({
  description: 'User does not have organization-level access to this resource.',
})
@UseGuards(InternalAuthGuard, OrganizationPolicyGuard)
@Controller('v1/workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @ApiOperation({ summary: 'List workspaces for the current organization.' })
  @ApiOkResponse({ type: WorkspaceListResponseDto })
  @OrganizationPermissions('workspaces.read')
  @Get()
  async listWorkspaces(@CurrentActor() actor: AuthenticatedInternalActor) {
    return {
      data: await this.workspacesService.listWorkspaces(actor.organization.id),
    };
  }

  @ApiOperation({ summary: 'Create a workspace for the current organization.' })
  @ApiCreatedResponse({ type: WorkspaceResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('workspaces.write')
  @Post()
  async createWorkspace(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: CreateWorkspaceDto,
  ) {
    return {
      data: await this.workspacesService.createWorkspace({
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        name: body.name,
        code: body.code,
        status: body.status,
      }),
    };
  }

  @ApiOperation({ summary: 'Get a workspace by id.' })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  @ApiNotFoundResponse({ description: 'Workspace not found.' })
  @OrganizationPermissions('workspaces.read')
  @Get(':id')
  async getWorkspace(
    @Param('id') workspaceId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    return {
      data: await this.workspacesService.getWorkspace(
        workspaceId,
        actor.organization.id,
      ),
    };
  }

  @ApiOperation({ summary: 'Update workspace metadata and status.' })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Workspace not found.' })
  @OrganizationPermissions('workspaces.write')
  @Patch(':id')
  async updateWorkspace(
    @Param('id') workspaceId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: UpdateWorkspaceDto,
  ) {
    return {
      data: await this.workspacesService.updateWorkspace(workspaceId, {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        name: body.name,
        code: body.code,
        status: body.status,
      }),
    };
  }
}
