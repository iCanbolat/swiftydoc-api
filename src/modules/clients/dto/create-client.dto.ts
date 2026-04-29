import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'ws_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  workspaceId!: string;

  @ApiProperty({ example: 'Acme Advisory LLC', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  displayName!: string;

  @ApiPropertyOptional({ example: 'Acme Advisory Limited', maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  legalName?: string;

  @ApiPropertyOptional({ example: 'ext_acme_001', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  externalRef?: string;

  @ApiPropertyOptional({ example: 'Istanbul', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  province?: string;

  @ApiPropertyOptional({ example: 'Besiktas', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  district?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      segment: 'kyc',
      owner: 'ops',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
