import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

const workspaceCodePattern = /^[A-Z0-9]{1,12}-[A-Z]{7}$/;

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Client Delivery', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'ACME-ABCDEFG', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(workspaceCodePattern)
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
