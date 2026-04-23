import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
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
import { CreateIntegrationConnectionDto } from './dto/create-integration-connection.dto';
import { CreateIntegrationConnectionResponseDto } from './dto/create-integration-connection-response.dto';
import { GetIntegrationDebugQueryDto } from './dto/get-integration-debug-query.dto';
import { GetIntegrationConnectionQueryDto } from './dto/get-integration-connection-query.dto';
import { IntegrationConnectionResponseDto } from './dto/integration-connection-response.dto';
import { IntegrationDebugResponseDto } from './dto/integration-debug-response.dto';
import { ListIntegrationProvidersResponseDto } from './dto/list-integration-providers-response.dto';
import { ListSyncJobsQueryDto } from './dto/list-sync-jobs-query.dto';
import { ListSyncJobsResponseDto } from './dto/list-sync-jobs-response.dto';
import { TestIntegrationConnectionDto } from './dto/test-integration-connection.dto';
import { TestIntegrationConnectionResponseDto } from './dto/test-integration-connection-response.dto';
import { TriggerSyncJobDto } from './dto/trigger-sync-job.dto';
import { TriggerSyncJobResponseDto } from './dto/trigger-sync-job-response.dto';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({
  description: 'User does not have organization-level access to this resource.',
})
@UseGuards(InternalAuthGuard, OrganizationPolicyGuard)
@Controller('v1/integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @ApiOperation({ summary: 'List supported native integration providers.' })
  @ApiOkResponse({ type: ListIntegrationProvidersResponseDto })
  @OrganizationPermissions('integrations.read')
  @Get('providers')
  listProviders() {
    return {
      data: this.integrationsService.listProviders(),
    };
  }

  @ApiOperation({ summary: 'Create an organization integration connection.' })
  @ApiCreatedResponse({ type: CreateIntegrationConnectionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('integrations.write')
  @Post('connections')
  async createConnection(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: CreateIntegrationConnectionDto,
  ) {
    const connection = await this.integrationsService.createConnection({
      organizationId: actor.organization.id,
      workspaceId: body.workspaceId,
      providerKey: body.providerKey,
      authType: body.authType,
      credentialsRef: body.credentialsRef,
      settings: body.settings,
      metadata: body.metadata,
      actorUserId: actor.user.id,
    });

    return {
      data: this.integrationsService.sanitizeConnection(connection),
    };
  }

  @ApiOperation({ summary: 'Get integration connection details.' })
  @ApiOkResponse({ type: IntegrationConnectionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Integration connection not found.' })
  @OrganizationPermissions('integrations.read')
  @Get('connections/:id')
  async getConnection(
    @Param('id') connectionId: string,
    @Query() query: GetIntegrationConnectionQueryDto,
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    const connection = await this.integrationsService.getConnection(
      connectionId,
      actor.organization.id,
    );

    return {
      data: this.integrationsService.sanitizeConnection(connection),
    };
  }

  @ApiOperation({
    summary:
      'Get integration connection debug data, recent syncs, and external references.',
  })
  @ApiOkResponse({ type: IntegrationDebugResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Integration connection not found.' })
  @OrganizationPermissions('integrations.read')
  @Get('connections/:id/debug')
  async getConnectionDebug(
    @Param('id') connectionId: string,
    @Query() query: GetIntegrationDebugQueryDto,
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    const snapshot = await this.integrationsService.getConnectionDebugSnapshot(
      connectionId,
      actor.organization.id,
    );

    return {
      data: {
        connection: this.integrationsService.sanitizeConnection(
          snapshot.connection,
        ),
        provider: snapshot.provider,
        recentSyncJobs: snapshot.recentSyncJobs,
        externalReferences: snapshot.externalReferences.map((reference) => ({
          ...reference,
          createdAt: reference.createdAt.toISOString(),
          lastSyncedAt: reference.lastSyncedAt.toISOString(),
          updatedAt: reference.updatedAt.toISOString(),
        })),
      },
    };
  }

  @ApiOperation({ summary: 'Test a configured integration connection.' })
  @ApiOkResponse({ type: TestIntegrationConnectionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Integration connection not found.' })
  @OrganizationPermissions('integrations.write')
  @Post('connections/:id/test')
  async testConnection(
    @Param('id') connectionId: string,
    @Body() body: TestIntegrationConnectionDto,
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    const tested = await this.integrationsService.testConnection(connectionId, {
      organizationId: actor.organization.id,
      actorUserId: actor.user.id,
    });

    return {
      data: {
        connection: this.integrationsService.sanitizeConnection(
          tested.connection,
        ),
        result: tested.result,
      },
    };
  }

  @ApiOperation({
    summary: 'Queue a manual sync job for an integration connection.',
  })
  @ApiCreatedResponse({ type: TriggerSyncJobResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Integration connection not found.' })
  @OrganizationPermissions('integrations.write')
  @Post('connections/:id/sync')
  async triggerSyncJob(
    @Param('id') connectionId: string,
    @Body() body: TriggerSyncJobDto,
    @CurrentActor() actor: AuthenticatedInternalActor,
  ) {
    const result = await this.integrationsService.queueSyncJob(connectionId, {
      organizationId: actor.organization.id,
      actorUserId: actor.user.id,
      targetResourceType: body.targetResourceType,
      targetResourceId: body.targetResourceId,
      payload: body.payload,
    });

    return {
      data: {
        ...result.syncJob,
        queueJobId: result.queueJobId,
      },
    };
  }
}

@ApiTags('Integrations')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ description: 'Bearer token is missing or invalid.' })
@ApiForbiddenResponse({
  description: 'User does not have organization-level access to this resource.',
})
@UseGuards(InternalAuthGuard, OrganizationPolicyGuard)
@Controller('v1/sync-jobs')
export class SyncJobsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @ApiOperation({ summary: 'List recent sync jobs for an organization.' })
  @ApiOkResponse({ type: ListSyncJobsResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @OrganizationPermissions('integrations.read')
  @Get()
  async listSyncJobs(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Query() query: ListSyncJobsQueryDto,
  ) {
    const jobs = await this.integrationsService.listSyncJobs({
      organizationId: actor.organization.id,
      connectionId: query.connectionId,
      status: query.status,
    });

    return {
      data: jobs,
    };
  }
}
