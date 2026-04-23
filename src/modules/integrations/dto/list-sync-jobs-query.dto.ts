import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  SYNC_JOB_STATUS_VALUES,
  type SyncJobStatus,
} from '../../../common/integrations/integration-types';

export class ListSyncJobsQueryDto {
  @ApiPropertyOptional({
    example: 'integration_connection_123',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  connectionId?: string;

  @ApiPropertyOptional({
    enum: SYNC_JOB_STATUS_VALUES,
    enumName: 'SyncJobStatus',
    example: 'succeeded',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(SYNC_JOB_STATUS_VALUES)
  status?: SyncJobStatus;
}
