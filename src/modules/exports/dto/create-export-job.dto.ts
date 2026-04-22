import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  EXPORT_JOB_TYPE_VALUES,
  type ExportJobType,
} from '../../../common/exports/export-types';
import { ExportArtifactDeliveryTargetDto } from './export-artifact-delivery-target.dto';

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
    type: () => ExportArtifactDeliveryTargetDto,
    isArray: true,
    example: [
      {
        connectionId: 'integration_connection_drive_123',
        fileName: 'request-export.zip',
        folderId: 'drive_folder_abc',
      },
      {
        connectionId: 'integration_connection_onedrive_123',
        itemId: '01ABCDEF1234567890',
        path: 'SwiftyDoc/Exports',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportArtifactDeliveryTargetDto)
  deliveryTargets?: ExportArtifactDeliveryTargetDto[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      locale: 'en',
      initiatedFrom: 'ops_dashboard',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
