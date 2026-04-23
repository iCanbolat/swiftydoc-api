import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateTemplateDto {
  @ApiPropertyOptional({ example: 'KYC Onboarding v2', maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: 'kyc-onboarding-v2', maxLength: 80 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  slug?: string;

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
    example: 'published',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(TEMPLATE_STATUS_VALUES)
  status?: TemplateStatus;
}
