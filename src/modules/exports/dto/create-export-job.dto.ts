import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  EXPORT_JOB_TYPE_VALUES,
  type ExportJobType,
} from '../../../common/exports/export-types';

export class CreateExportJobDto {
  @ApiProperty({ example: 'org_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId!: string;

  @ApiProperty({
    enum: EXPORT_JOB_TYPE_VALUES,
    enumName: 'ExportJobType',
    example: 'zip',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(EXPORT_JOB_TYPE_VALUES)
  exportType!: ExportJobType;

  @ApiPropertyOptional({ example: 'req_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  requestId?: string;

  @ApiPropertyOptional({ example: 'submission_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  submissionId?: string;

  @ApiPropertyOptional({ example: 'user_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  requestedByUserId?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  includeFiles?: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      locale: 'en',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
