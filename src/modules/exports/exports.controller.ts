import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CreateExportJobDto } from './dto/create-export-job.dto';
import { CreateExportJobResponseDto } from './dto/create-export-job-response.dto';
import { ExportJobResponseDto } from './dto/export-job-response.dto';
import { GetExportJobQueryDto } from './dto/get-export-job-query.dto';
import { ReplayExportDeliveryDto } from './dto/replay-export-delivery.dto';
import { ExportsService } from './exports.service';
import type {
  ExportArtifactDeliveryTarget,
  ExportArtifactDeliveryResult,
  ExportJobMetadata,
} from './exports.types';

@ApiTags('Exports')
@Controller('v1/exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @ApiOperation({ summary: 'Queue a ZIP/PDF/CSV export job.' })
  @ApiCreatedResponse({ type: CreateExportJobResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @Post('jobs')
  async createExportJob(@Body() body: CreateExportJobDto) {
    const exportJob = await this.exportsService.createExportJob({
      organizationId: body.organizationId,
      exportType: body.exportType,
      requestId: body.requestId,
      submissionId: body.submissionId,
      requestedByUserId: body.requestedByUserId,
      includeFiles: body.includeFiles,
      deliveryTargets: body.deliveryTargets,
      metadata: body.metadata,
    });

    return {
      data: exportJob,
    };
  }

  @ApiOperation({ summary: 'Get export job status and artifact links.' })
  @ApiOkResponse({ type: ExportJobResponseDto })
  @ApiBadRequestResponse({ description: 'DTO validation failed.' })
  @ApiNotFoundResponse({ description: 'Export job not found.' })
  @Get('jobs/:id')
  async getExportJob(
    @Param('id') exportJobId: string,
    @Query() query: GetExportJobQueryDto,
    @Req() req: Request,
  ) {
    const exportJob = await this.exportsService.getExportJob(
      exportJobId,
      query.organizationId,
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
  @Post('jobs/:id/delivery/replay')
  async replayExportDelivery(
    @Param('id') exportJobId: string,
    @Body() body: ReplayExportDeliveryDto,
    @Req() req: Request,
  ) {
    const exportJob = await this.exportsService.replayExportDelivery(
      exportJobId,
      {
        organizationId: body.organizationId,
        actorUserId: body.actorUserId,
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
