import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Client Delivery', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'client-delivery', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @ApiPropertyOptional({
    enum: WORKSPACE_STATUS_VALUES,
    enumName: 'WorkspaceStatus',
    example: 'active',
    default: 'active',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(WORKSPACE_STATUS_VALUES)
  status?: WorkspaceStatus;
}
