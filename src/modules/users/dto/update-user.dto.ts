import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  MANAGED_USER_STATUS_VALUES,
  type ManagedUserStatus,
} from '../users.types';
import { UserWorkspaceAssignmentDto } from './user-workspace-assignment.dto';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Aylin Demir', maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName?: string;

  @ApiPropertyOptional({ example: 'tr', maxLength: 16 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  locale?: string;

  @ApiPropertyOptional({ example: '+905551112233', maxLength: 32 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({
    enum: MANAGED_USER_STATUS_VALUES,
    enumName: 'ManagedUserStatus',
    example: 'disabled',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(MANAGED_USER_STATUS_VALUES)
  status?: ManagedUserStatus;

  @ApiPropertyOptional({
    type: () => UserWorkspaceAssignmentDto,
    isArray: true,
  })
  @IsOptional()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UserWorkspaceAssignmentDto)
  memberships?: UserWorkspaceAssignmentDto[];
}
