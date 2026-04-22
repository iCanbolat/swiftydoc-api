import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SYNC_JOB_STATUS_VALUES, SYNC_JOB_TYPE_VALUES } from '../../../common/integrations/integration-types';

export class TriggerSyncJobResponseDataDto {
  @ApiProperty({ example: 'sync_job_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiProperty({ example: 'integration_connection_123' })
  connectionId!: string;

  @ApiProperty({
    enum: SYNC_JOB_TYPE_VALUES,
    enumName: 'SyncJobType',
    example: 'manual_sync',
  })
  jobType!: (typeof SYNC_JOB_TYPE_VALUES)[number];

  @ApiProperty({
    enum: SYNC_JOB_STATUS_VALUES,
    enumName: 'SyncJobStatus',
    example: 'queued',
  })
  status!: (typeof SYNC_JOB_STATUS_VALUES)[number];

  @ApiProperty({ example: '8d8748ee-6619-4bbf-a06b-6470f85f3354' })
  queueJobId!: string;

  @ApiPropertyOptional({ example: 'request', nullable: true })
  targetResourceType!: string | null;

  @ApiPropertyOptional({ example: 'req_123', nullable: true })
  targetResourceId!: string | null;

  @ApiProperty({ example: 0 })
  attemptCount!: number;

  @ApiPropertyOptional({ nullable: true, example: null })
  lastErrorCode!: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  lastErrorMessage!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      syncMode: 'metadata_refresh',
    },
  })
  payload!: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {},
  })
  result!: Record<string, unknown>;

  @ApiProperty({ example: '2026-04-22T14:05:00.000Z' })
  queuedAt!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  startedAt!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  finishedAt!: string | null;
}

export class TriggerSyncJobResponseDto {
  @ApiProperty({ type: () => TriggerSyncJobResponseDataDto })
  data!: TriggerSyncJobResponseDataDto;
}