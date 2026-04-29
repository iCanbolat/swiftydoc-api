import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CLIENT_STATUS_VALUES, type ClientStatus } from '../clients.types';

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Acme Advisory Holdings', maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  displayName?: string;

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
    enum: CLIENT_STATUS_VALUES,
    enumName: 'ClientStatus',
    example: 'archived',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(CLIENT_STATUS_VALUES)
  status?: ClientStatus;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      segment: 'renewal',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
