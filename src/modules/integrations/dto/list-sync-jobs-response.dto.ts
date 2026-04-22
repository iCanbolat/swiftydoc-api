import { ApiProperty } from '@nestjs/swagger';
import { TriggerSyncJobResponseDataDto } from './trigger-sync-job-response.dto';

export class ListSyncJobsResponseDto {
  @ApiProperty({ type: () => TriggerSyncJobResponseDataDto, isArray: true })
  data!: TriggerSyncJobResponseDataDto[];
}