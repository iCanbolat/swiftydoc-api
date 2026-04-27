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
import {
  MAX_LENGTH_EMAIL,
  MAX_LENGTH_FULL_NAME,
  MAX_LENGTH_LOCALE,
  MAX_LENGTH_ORGANIZATION_NAME,
  MAX_LENGTH_ORGANIZATION_SLUG,
  MAX_LENGTH_PHONE,
  MAX_LENGTH_REGION,
  MAX_LENGTH_TIMEZONE,
  MAX_LENGTH_WORKSPACE_NAME,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SLUG_PATTERN,
  WORKSPACE_CODE_PATTERN,
} from '../auth.constants';

export class BootstrapOwnerDto {
  @ApiProperty({ example: 'Acme Advisory' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_ORGANIZATION_NAME)
  organizationName!: string;

  @ApiProperty({ example: 'acme-advisory' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_ORGANIZATION_SLUG)
  @Matches(SLUG_PATTERN)
  organizationSlug!: string;

  @ApiProperty({ example: 'Client Delivery' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_WORKSPACE_NAME)
  workspaceName!: string;

  @ApiPropertyOptional({ example: 'ACM-ABCDE' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(9)
  @Matches(WORKSPACE_CODE_PATTERN)
  workspaceCode?: string;

  @ApiProperty({ example: 'owner@acme.test' })
  @IsEmail()
  @MaxLength(MAX_LENGTH_EMAIL)
  ownerEmail!: string;

  @ApiProperty({ example: 'Aylin Demir' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_FULL_NAME)
  ownerFullName!: string;

  @ApiProperty({ example: 'SwiftyDoc2025!' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiPropertyOptional({ example: 'Acmecorp LLC' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_FULL_NAME)
  legalName?: string;

  @ApiPropertyOptional({ example: 'tr' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_LOCALE)
  locale?: string;

  @ApiPropertyOptional({ example: '+905551112233' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_PHONE)
  phone?: string;

  @ApiPropertyOptional({ example: 'mena' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_REGION)
  primaryRegion?: string;

  @ApiPropertyOptional({ example: 'Europe/Istanbul' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_TIMEZONE)
  timezone?: string;
}
