import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRequestDto {
  @ApiProperty({ example: 'ws_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  workspaceId!: string;

  @ApiProperty({ example: 'client_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  clientId!: string;

  @ApiProperty({ example: 'tpl_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  templateId!: string;

  @ApiProperty({ example: 'tpl_ver_001', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  templateVersionId!: string;

  @ApiProperty({ example: 'KYC onboarding - ACME Ltd', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ example: '2026-05-05T09:30:00.000Z' })
  @IsOptional()
  @IsString()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional({ example: 'REQ-ONBOARDING-001', maxLength: 64 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  requestCode?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['recipient_123', 'recipient_456'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(120, { each: true })
  recipientIds?: string[];
}
