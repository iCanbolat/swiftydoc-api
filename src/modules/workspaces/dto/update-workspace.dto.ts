import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  WORKSPACE_STATUS_VALUES,
  type WorkspaceStatus,
} from '../workspaces.types';

const workspaceCodePattern = /^[A-Z0-9]{3}-[A-Z]{5}$/;

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Client Delivery', maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: 'ACM-ABCDE', maxLength: 9 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(9)
  @Matches(workspaceCodePattern)
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
