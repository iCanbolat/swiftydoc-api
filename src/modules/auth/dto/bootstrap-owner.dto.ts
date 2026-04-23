import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class BootstrapOwnerDto {
  @ApiProperty({ example: 'Acme Advisory' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  organizationName!: string;

  @ApiProperty({ example: 'acme-advisory' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(slugPattern)
  organizationSlug!: string;

  @ApiProperty({ example: 'Client Delivery' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  workspaceName!: string;

  @ApiPropertyOptional({ example: 'client-delivery' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(slugPattern)
  workspaceCode?: string;

  @ApiProperty({ example: 'owner@acme.test' })
  @IsEmail()
  @MaxLength(255)
  ownerEmail!: string;

  @ApiProperty({ example: 'Aylin Demir' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  ownerFullName!: string;

  @ApiProperty({ example: 'SwiftyDoc2025!' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Acmecorp LLC' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  legalName?: string;

  @ApiPropertyOptional({ example: 'tr' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  locale?: string;

  @ApiPropertyOptional({ example: '+905551112233' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ example: 'mena' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  primaryRegion?: string;

  @ApiPropertyOptional({ example: 'Europe/Istanbul' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timezone?: string;
}
