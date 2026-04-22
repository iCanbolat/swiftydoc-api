import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsHexColor,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpsertBrandingSettingsDto {
  @ApiProperty({ example: 'org_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId!: string;

  @ApiPropertyOptional({ example: 'user_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  actorUserId?: string;

  @ApiProperty({ example: 'SwiftyDoc' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  displayName!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsUrl()
  @MaxLength(512)
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#0A1F44' })
  @IsOptional()
  @IsHexColor()
  @MaxLength(16)
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#14B8A6' })
  @IsOptional()
  @IsHexColor()
  @MaxLength(16)
  secondaryColor?: string;

  @ApiPropertyOptional({ example: 'SwiftyDoc Team' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  emailFromName?: string;

  @ApiPropertyOptional({ example: 'support@swiftydoc.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  emailReplyTo?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      legalFooter: 'Confidential communication',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
