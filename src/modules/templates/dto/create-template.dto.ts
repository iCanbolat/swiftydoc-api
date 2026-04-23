import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  TEMPLATE_STATUS_VALUES,
  type TemplateStatus,
} from '../templates.types';

export class CreateTemplateDto {
  @ApiProperty({ example: 'ws_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  workspaceId!: string;

  @ApiProperty({ example: 'KYC Onboarding', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'kyc-onboarding', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  slug!: string;

  @ApiPropertyOptional({
    example: 'Collect core onboarding documents.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    enum: TEMPLATE_STATUS_VALUES,
    enumName: 'TemplateStatus',
    example: 'draft',
    default: 'draft',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(TEMPLATE_STATUS_VALUES)
  status?: TemplateStatus;
}
