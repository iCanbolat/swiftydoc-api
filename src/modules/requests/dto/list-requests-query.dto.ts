import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/pagination.dto';
import {
  REQUEST_STATUS_VALUES,
  type RequestStatus,
} from '../../../common/requests/request-workflow';

export class ListRequestsQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'ws_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  workspaceId!: string;

  @ApiPropertyOptional({ example: 'client_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  clientId?: string;

  @ApiPropertyOptional({
    enum: REQUEST_STATUS_VALUES,
    enumName: 'RequestStatus',
    example: 'in_progress',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(REQUEST_STATUS_VALUES)
  status?: RequestStatus;
}
