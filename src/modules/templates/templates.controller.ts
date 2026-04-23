import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { WorkspaceAccess } from '../auth/workspace-access.decorator';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ListTemplatesQueryDto } from './dto/list-templates-query.dto';
import {
  TemplateListResponseDto,
  TemplateResponseDto,
} from './dto/template-response.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';

@ApiTags('Templates')
@ApiBearerAuth('bearer')
@UseGuards(InternalAuthGuard, WorkspaceMembershipGuard)
@Controller('v1/templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @ApiOperation({ summary: 'List templates for a workspace.' })
  @ApiOkResponse({ type: TemplateListResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({
    key: 'workspaceId',
    resource: 'workspace',
    source: 'query',
  })
  @Get()
  async listTemplates(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Query() query: ListTemplatesQueryDto,
  ) {
    const items = await this.templatesService.listTemplates(
      actor.organization.id,
      query.workspaceId,
    );

    return {
      data: items.map((item) => this.templatesService.serializeTemplate(item)),
    };
  }

  @ApiOperation({ summary: 'Create a template in a workspace.' })
  @ApiCreatedResponse({ type: TemplateResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({
    key: 'workspaceId',
    resource: 'workspace',
    source: 'body',
  })
  @Post()
  async createTemplate(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: CreateTemplateDto,
  ) {
    const template = await this.templatesService.createTemplate({
      organizationId: actor.organization.id,
      workspaceId: body.workspaceId,
      name: body.name,
      slug: body.slug,
      description: body.description,
      status: body.status,
      actorUserId: actor.user.id,
    });

    return {
      data: this.templatesService.serializeTemplate(template),
    };
  }

  @ApiOperation({ summary: 'Get a template by id.' })
  @ApiOkResponse({ type: TemplateResponseDto })
  @ApiNotFoundResponse({ description: 'Template not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'template', source: 'param' })
  @Get(':id')
  async getTemplate(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Param('id') templateId: string,
  ) {
    const template = await this.templatesService.getTemplate(
      templateId,
      actor.organization.id,
    );

    return {
      data: this.templatesService.serializeTemplate(template),
    };
  }

  @ApiOperation({ summary: 'Update template metadata and status.' })
  @ApiOkResponse({ type: TemplateResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Template not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'template', source: 'param' })
  @Patch(':id')
  async updateTemplate(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Param('id') templateId: string,
    @Body() body: UpdateTemplateDto,
  ) {
    const template = await this.templatesService.updateTemplate(templateId, {
      organizationId: actor.organization.id,
      name: body.name,
      slug: body.slug,
      description: body.description,
      status: body.status,
      actorUserId: actor.user.id,
    });

    return {
      data: this.templatesService.serializeTemplate(template),
    };
  }
}
