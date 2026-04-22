import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EXPORT_JOB_STATUS_VALUES,
  EXPORT_JOB_TYPE_VALUES,
} from '../../../common/exports/export-types';
import { EXPORT_ARTIFACT_DELIVERY_STATUS_VALUES } from '../exports.types';
import { ExportArtifactDeliveryTargetDto } from './export-artifact-delivery-target.dto';

export class ExportArtifactDeliveryResultDto {
  @ApiProperty({ example: 'integration_connection_drive_123' })
  connectionId!: string;

  @ApiProperty({ example: 'google_drive' })
  providerKey!: string;

  @ApiProperty({ enum: ['delivered', 'failed'], example: 'delivered' })
  status!: 'delivered' | 'failed';

  @ApiProperty({ example: '2026-04-22T13:10:08.000Z' })
  deliveredAt!: string;

  @ApiPropertyOptional({ example: '1AbCdEfGhIjKlMnOp', nullable: true })
  remoteFileId!: string | null;

  @ApiPropertyOptional({ example: 'export_job_123.zip', nullable: true })
  remoteFileName!: string | null;

  @ApiPropertyOptional({
    example: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view',
    nullable: true,
  })
  remoteFileUrl!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  errorMessage!: string | null;
}

export class ExportJobResponseDataDto {
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
    example: 'completed',
  })
  status!: (typeof EXPORT_JOB_STATUS_VALUES)[number];

  @ApiPropertyOptional({ example: 'req_123', nullable: true })
  requestId!: string | null;

  @ApiPropertyOptional({ example: 'submission_123', nullable: true })
  submissionId!: string | null;

  @ApiPropertyOptional({
    example: 'org_123/exports/2026-04-22/export_job_123.zip',
    nullable: true,
  })
  artifactStorageKey!: string | null;

  @ApiPropertyOptional({ example: 'application/zip', nullable: true })
  artifactMimeType!: string | null;

  @ApiPropertyOptional({ example: 987654, nullable: true })
  artifactSizeBytes!: number | null;

  @ApiProperty({ type: () => ExportArtifactDeliveryTargetDto, isArray: true })
  deliveryTargets!: ExportArtifactDeliveryTargetDto[];

  @ApiProperty({
    enum: EXPORT_ARTIFACT_DELIVERY_STATUS_VALUES,
    enumName: 'ExportArtifactDeliveryStatus',
    example: 'delivered',
  })
  deliveryStatus!: (typeof EXPORT_ARTIFACT_DELIVERY_STATUS_VALUES)[number];

  @ApiProperty({
    type: () => ExportArtifactDeliveryResultDto,
    isArray: true,
  })
  deliveryResults!: ExportArtifactDeliveryResultDto[];

  @ApiPropertyOptional({
    example:
      'https://pullzone.example.com/org_123/exports/2026-04-22/export_job_123.zip',
    nullable: true,
  })
  publicUrl!: string | null;

  @ApiPropertyOptional({
    example:
      'http://localhost:3000/v1/files/download?key=org_123%2Fexports%2F2026-04-22%2Fexport_job_123.zip',
    nullable: true,
  })
  downloadUrl!: string | null;

  @ApiPropertyOptional({
    example: 'Unsupported MIME type for one of the files.',
    nullable: true,
  })
  errorMessage!: string | null;

  @ApiProperty({ example: '2026-04-22T13:10:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: '2026-04-22T13:10:05.000Z', nullable: true })
  startedAt!: string | null;

  @ApiPropertyOptional({ example: '2026-04-22T13:10:08.000Z', nullable: true })
  completedAt!: string | null;
}

export class ExportJobResponseDto {
  @ApiProperty({ type: () => ExportJobResponseDataDto })
  data!: ExportJobResponseDataDto;
}
