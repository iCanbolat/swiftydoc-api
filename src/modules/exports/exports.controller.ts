import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
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
import type { Request } from 'express';
import { CurrentActor } from '../auth/current-actor.decorator';
import { CurrentWorkspaceId } from '../auth/current-workspace-id.decorator';
import type { AuthenticatedInternalActor } from '../auth/auth.types';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { WorkspaceAccess } from '../auth/workspace-access.decorator';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard';
import { CreateExportJobDto } from './dto/create-export-job.dto';
import { CreateExportJobResponseDto } from './dto/create-export-job-response.dto';
import { ExportJobResponseDto } from './dto/export-job-response.dto';
import { ReplayExportDeliveryDto } from './dto/replay-export-delivery.dto';
import { ExportsService } from './exports.service';
import type {
  ExportArtifactDeliveryTarget,
  ExportArtifactDeliveryResult,
  ExportJobMetadata,
} from './exports.types';

@ApiTags('Exports')
@ApiBearerAuth('bearer')
@UseGuards(InternalAuthGuard, WorkspaceMembershipGuard)
@Controller('v1/exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @ApiOperation({ summary: 'Queue a ZIP/PDF/CSV export job.' })
  @ApiCreatedResponse({ type: CreateExportJobResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({
    fallbackToActiveWorkspace: true,
    resource: 'exportContext',
  })
  @Post('jobs')
  async createExportJob(
    @CurrentActor() actor: AuthenticatedInternalActor,
    @CurrentWorkspaceId() workspaceId: string,
    @Body() body: CreateExportJobDto,
  ) {
    const exportJob = await this.exportsService.createExportJob({
      organizationId: actor.organization.id,
      exportType: body.exportType,
      requestId: body.requestId,
      submissionId: body.submissionId,
      requestedByUserId: actor.user.id,
      includeFiles: body.includeFiles,
      deliveryTargets: body.deliveryTargets,
      metadata: {
        ...(body.metadata ?? {}),
        workspaceId,
      },
    });

    return {
      data: exportJob,
    };
  }

  @ApiOperation({ summary: 'Get export job status and artifact links.' })
  @ApiOkResponse({ type: ExportJobResponseDto })
  @ApiNotFoundResponse({ description: 'Export job not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'exportJob', source: 'param' })
  @Get('jobs/:id')
  async getExportJob(
    @Param('id') exportJobId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Req() req: Request,
  ) {
    const exportJob = await this.exportsService.getExportJob(
      exportJobId,
      actor.organization.id,
    );
    return {
      data: this.buildExportJobResponseData(exportJob, req),
    };
  }

  @ApiOperation({
    summary: 'Replay export artifact delivery to failed or selected targets.',
  })
  @ApiOkResponse({ type: ExportJobResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Export job not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to this workspace.',
  })
  @WorkspaceAccess({ key: 'id', resource: 'exportJob', source: 'param' })
  @Post('jobs/:id/delivery/replay')
  async replayExportDelivery(
    @Param('id') exportJobId: string,
    @CurrentActor() actor: AuthenticatedInternalActor,
    @Body() body: ReplayExportDeliveryDto,
    @Req() req: Request,
  ) {
    const exportJob = await this.exportsService.replayExportDelivery(
      exportJobId,
      {
        organizationId: actor.organization.id,
        actorUserId: actor.user.id,
        connectionIds: body.connectionIds,
        failedOnly: body.failedOnly,
      },
    );

    return {
      data: this.buildExportJobResponseData(exportJob, req),
    };
  }

  private resolveBaseUrl(req: Request): string {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const firstForwardedProto = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto;
    const protocol = firstForwardedProto || req.protocol || 'http';

    return `${protocol}://${req.get('host')}`;
  }

  private buildExportJobResponseData(
    exportJob: Awaited<ReturnType<ExportsService['getExportJob']>>,
    req: Request,
  ) {
    const metadata = exportJob.metadata as ExportJobMetadata;
    const deliveryResults = Array.isArray(metadata.deliveryResults)
      ? (metadata.deliveryResults as ExportArtifactDeliveryResult[])
      : [];
    const deliveryTargets = Array.isArray(metadata.deliveryTargets)
      ? (metadata.deliveryTargets as ExportArtifactDeliveryTarget[])
      : [];
    const artifactStorageKey = exportJob.artifactStorageKey;

    return {
      id: exportJob.id,
      organizationId: exportJob.organizationId,
      type: exportJob.type,
      status: exportJob.status,
      requestId: exportJob.requestId,
      submissionId: exportJob.submissionId,
      artifactStorageKey,
      artifactMimeType: exportJob.artifactMimeType,
      artifactSizeBytes: exportJob.artifactSizeBytes,
      deliveryTargets,
      deliveryResults,
      deliveryStatus: metadata.deliveryStatus ?? 'not_configured',
      publicUrl: artifactStorageKey
        ? this.exportsService.getPublicExportUrl(artifactStorageKey)
        : null,
      downloadUrl: artifactStorageKey
        ? this.exportsService.createDownloadLink(
            artifactStorageKey,
            this.resolveBaseUrl(req),
          )
        : null,
      errorMessage: exportJob.errorMessage,
      createdAt: exportJob.createdAt.toISOString(),
      startedAt: exportJob.startedAt?.toISOString() ?? null,
      completedAt: exportJob.completedAt?.toISOString() ?? null,
    };
  }
}
