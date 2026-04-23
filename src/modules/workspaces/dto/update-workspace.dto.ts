import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  WORKSPACE_STATUS_VALUES,
  type WorkspaceStatus,
} from '../workspaces.types';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Client Delivery', maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: 'client-delivery', maxLength: 64 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional({
    enum: WORKSPACE_STATUS_VALUES,
    enumName: 'WorkspaceStatus',
    example: 'archived',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(WORKSPACE_STATUS_VALUES)
  status?: WorkspaceStatus;
}
