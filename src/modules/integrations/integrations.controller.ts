import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateIntegrationConnectionDto } from './dto/create-integration-connection.dto';
import { CreateIntegrationConnectionResponseDto } from './dto/create-integration-connection-response.dto';
import { GetIntegrationConnectionQueryDto } from './dto/get-integration-connection-query.dto';
import { IntegrationConnectionResponseDto } from './dto/integration-connection-response.dto';
import { ListIntegrationProvidersResponseDto } from './dto/list-integration-providers-response.dto';
import { ListSyncJobsQueryDto } from './dto/list-sync-jobs-query.dto';
import { ListSyncJobsResponseDto } from './dto/list-sync-jobs-response.dto';
import { TestIntegrationConnectionDto } from './dto/test-integration-connection.dto';
import { TestIntegrationConnectionResponseDto } from './dto/test-integration-connection-response.dto';
import { TriggerSyncJobDto } from './dto/trigger-sync-job.dto';
import { TriggerSyncJobResponseDto } from './dto/trigger-sync-job-response.dto';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@Controller('v1/integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @ApiOperation({ summary: 'List supported native integration providers.' })
  @ApiOkResponse({ type: ListIntegrationProvidersResponseDto })
  @Get('providers')
  listProviders() {
    return {
      data: this.integrationsService.listProviders(),
    };
  }

  @ApiOperation({ summary: 'Create an organization integration connection.' })
  @ApiCreatedResponse({ type: CreateIntegrationConnectionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @Post('connections')
  async createConnection(@Body() body: CreateIntegrationConnectionDto) {
    const connection = await this.integrationsService.createConnection({
      organizationId: body.organizationId,
      workspaceId: body.workspaceId,
      providerKey: body.providerKey,
      authType: body.authType,
      credentialsRef: body.credentialsRef,
      settings: body.settings,
      metadata: body.metadata,
      actorUserId: body.actorUserId,
    });

    return {
      data: this.integrationsService.sanitizeConnection(connection),
    };
  }

  @ApiOperation({ summary: 'Get integration connection details.' })
  @ApiOkResponse({ type: IntegrationConnectionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Integration connection not found.' })
  @Get('connections/:id')
  async getConnection(
    @Param('id') connectionId: string,
    @Query() query: GetIntegrationConnectionQueryDto,
  ) {
    const connection = await this.integrationsService.getConnection(
      connectionId,
      query.organizationId,
    );

    return {
      data: this.integrationsService.sanitizeConnection(connection),
    };
  }

  @ApiOperation({ summary: 'Test a configured integration connection.' })
  @ApiOkResponse({ type: TestIntegrationConnectionResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Integration connection not found.' })
  @Post('connections/:id/test')
  async testConnection(
    @Param('id') connectionId: string,
    @Body() body: TestIntegrationConnectionDto,
  ) {
    const tested = await this.integrationsService.testConnection(connectionId, {
      organizationId: body.organizationId,
      actorUserId: body.actorUserId,
    });

    return {
      data: {
        connection: this.integrationsService.sanitizeConnection(tested.connection),
        result: tested.result,
      },
    };
  }

  @ApiOperation({ summary: 'Queue a manual sync job for an integration connection.' })
  @ApiCreatedResponse({ type: TriggerSyncJobResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Integration connection not found.' })
  @Post('connections/:id/sync')
  async triggerSyncJob(
    @Param('id') connectionId: string,
    @Body() body: TriggerSyncJobDto,
  ) {
    const result = await this.integrationsService.queueSyncJob(connectionId, {
      organizationId: body.organizationId,
      actorUserId: body.actorUserId,
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
@Controller('v1/sync-jobs')
export class SyncJobsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @ApiOperation({ summary: 'List recent sync jobs for an organization.' })
  @ApiOkResponse({ type: ListSyncJobsResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @Get()
  async listSyncJobs(@Query() query: ListSyncJobsQueryDto) {
    const jobs = await this.integrationsService.listSyncJobs({
      organizationId: query.organizationId,
      connectionId: query.connectionId,
      status: query.status,
    });

    return {
      data: jobs,
    };
  }
}