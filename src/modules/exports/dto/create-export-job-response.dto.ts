import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EXPORT_JOB_STATUS_VALUES,
  EXPORT_JOB_TYPE_VALUES,
} from '../../../common/exports/export-types';
import { ExportArtifactDeliveryTargetDto } from './export-artifact-delivery-target.dto';

export class CreateExportJobResponseDataDto {
  @ApiProperty({ example: 'export_job_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiProperty({
    enum: EXPORT_JOB_TYPE_VALUES,
    enumName: 'ExportJobType',
    example: 'zip',
  })
  type!: (typeof EXPORT_JOB_TYPE_VALUES)[number];

  @ApiProperty({
    enum: EXPORT_JOB_STATUS_VALUES,
    enumName: 'ExportJobStatus',
    example: 'queued',
  })
  status!: (typeof EXPORT_JOB_STATUS_VALUES)[number];

  @ApiPropertyOptional({ example: 'req_123', nullable: true })
  requestId!: string | null;

  @ApiPropertyOptional({ example: 'submission_123', nullable: true })
  submissionId!: string | null;

  @ApiProperty({ type: () => ExportArtifactDeliveryTargetDto, isArray: true })
  deliveryTargets!: ExportArtifactDeliveryTargetDto[];

  @ApiProperty({ example: '8d8748ee-6619-4bbf-a06b-6470f85f3354' })
  queueJobId!: string;

  @ApiProperty({ example: '2026-04-22T13:10:00.000Z' })
  createdAt!: string;
}

export class CreateExportJobResponseDto {
  @ApiProperty({ type: () => CreateExportJobResponseDataDto })
  data!: CreateExportJobResponseDataDto;
}
