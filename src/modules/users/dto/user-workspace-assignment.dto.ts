import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  INTERNAL_ROLE_NAMES,
  type InternalRoleName,
} from '../../auth/internal-role.types';

export class UserWorkspaceAssignmentDto {
  @ApiProperty({ example: 'workspace_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  workspaceId!: string;

  @ApiProperty({
    enum: INTERNAL_ROLE_NAMES,
    enumName: 'InternalRoleName',
    example: 'workspace_manager',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(INTERNAL_ROLE_NAMES)
  roleName!: InternalRoleName;
}
