import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  OAUTH_APPLICATION_TYPE_VALUES,
  type OAuthApplicationType,
} from '../applications.types';

export class CreateOAuthApplicationDto {
  @ApiProperty({ example: 'SwiftyDoc Partner App', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({
    example: 'Internal onboarding automation client.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['https://partner.example.com/oauth/callback'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUrl({ require_protocol: true, require_tld: false }, { each: true })
  redirectUris?: string[];

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['requests.read', 'requests.write', 'files.read'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(120, { each: true })
  allowedScopes?: string[];

  @ApiPropertyOptional({
    enum: OAUTH_APPLICATION_TYPE_VALUES,
    enumName: 'OAuthApplicationType',
    example: 'confidential',
    default: 'confidential',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(OAUTH_APPLICATION_TYPE_VALUES)
  applicationType?: OAuthApplicationType;
}
