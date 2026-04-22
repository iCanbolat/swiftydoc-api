import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ExportArtifactDeliveryTargetDto {
  @ApiProperty({ example: 'integration_connection_drive_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  connectionId!: string;

  @ApiPropertyOptional({ example: 'drive_abc123', maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  driveId?: string;

  @ApiPropertyOptional({ example: 'request-export.zip', maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ example: 'drive_folder_abc', maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  folderId?: string;

  @ApiPropertyOptional({ example: '01ABCDEF1234567890', maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  itemId?: string;

  @ApiPropertyOptional({ example: 'SwiftyDoc/Exports', maxLength: 512 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  path?: string;

  @ApiPropertyOptional({ example: 'site_abc123', maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  siteId?: string;
}
