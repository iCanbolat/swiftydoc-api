import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReplayExportDeliveryDto {
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['integration_connection_drive_123'],
    description:
      'Optional subset of delivery targets to replay. When omitted, failed targets are replayed by default.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(120, { each: true })
  connectionIds?: string[];

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'When true and connectionIds is omitted, only previously failed delivery targets are replayed.',
  })
  @IsOptional()
  @IsBoolean()
  failedOnly?: boolean;
}
