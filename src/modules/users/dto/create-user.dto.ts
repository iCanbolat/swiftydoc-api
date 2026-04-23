import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { UserWorkspaceAssignmentDto } from './user-workspace-assignment.dto';

export class CreateUserDto {
  @ApiProperty({ example: 'operator@acme.test', maxLength: 255 })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Aylin Demir', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

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

  @ApiProperty({
    type: () => UserWorkspaceAssignmentDto,
    isArray: true,
  })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UserWorkspaceAssignmentDto)
  memberships!: UserWorkspaceAssignmentDto[];
}
