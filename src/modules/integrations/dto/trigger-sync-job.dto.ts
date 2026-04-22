import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class TriggerSyncJobDto {
  @ApiProperty({ example: 'org_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId!: string;

  @ApiPropertyOptional({ example: 'request', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  targetResourceType?: string;

  @ApiPropertyOptional({ example: 'req_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  targetResourceId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Generic integration sync payload. Accounting/ERP providers accept an upsert envelope; storage providers accept an export artifact upload envelope.',
    example: {
      domain: 'storage',
      entityType: 'export_artifact',
      operation: 'upload',
      source: {
        resourceType: 'export_job',
        resourceId: 'export_job_123',
        displayName: 'Request Export',
      },
      destination: {
        connectionId: 'integration_connection_drive_123',
        folderId: 'drive_folder_abc',
      },
      artifact: {
        fileName: 'request-export.zip',
        mimeType: 'application/zip',
        sizeBytes: 987654,
        storageKey: 'org_123/exports/2026-04-22/export_job_123.zip',
      },
    },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'user_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  actorUserId?: string;
}
