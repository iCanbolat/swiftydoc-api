import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  MAX_LENGTH_LOCALE,
  MAX_LENGTH_ORGANIZATION_NAME,
  MAX_LENGTH_ORGANIZATION_SLUG,
  MAX_LENGTH_REGION,
  MAX_LENGTH_TIMEZONE,
  MAX_LENGTH_WORKSPACE_NAME,
  SLUG_PATTERN,
  WORKSPACE_CODE_PATTERN,
} from '../auth.constants';

const googleAuthIntentValues = ['sign_in', 'sign_up'] as const;

export class StartGoogleAuthQueryDto {
  @ApiPropertyOptional({ example: 'sign_up', enum: googleAuthIntentValues })
  @IsOptional()
  @IsString()
  @IsIn(googleAuthIntentValues)
  intent?: 'sign_in' | 'sign_up';

  @ApiPropertyOptional({ example: 'swd_inv_0123456789abcdef' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  inviteToken?: string;

  @ApiPropertyOptional({ example: 'acme-advisory' })
  @ValidateIf(
    (payload: StartGoogleAuthQueryDto) =>
      payload.intent === 'sign_up' || payload.organizationSlug !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_ORGANIZATION_SLUG)
  @Matches(SLUG_PATTERN)
  organizationSlug?: string;

  @ApiPropertyOptional({ example: 'Acme Advisory' })
  @ValidateIf(
    (payload: StartGoogleAuthQueryDto) => payload.intent === 'sign_up',
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_ORGANIZATION_NAME)
  organizationName?: string;

  @ApiPropertyOptional({ example: 'Client Delivery' })
  @ValidateIf(
    (payload: StartGoogleAuthQueryDto) => payload.intent === 'sign_up',
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_WORKSPACE_NAME)
  workspaceName?: string;

  @ApiPropertyOptional({ example: 'ACM-ABCDE' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(9)
  @Matches(WORKSPACE_CODE_PATTERN)
  workspaceCode?: string;

  @ApiPropertyOptional({ example: 'Acmecorp LLC' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_ORGANIZATION_NAME)
  legalName?: string;

  @ApiPropertyOptional({ example: 'tr' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LENGTH_LOCALE)
  locale?: string;

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

export class GoogleAuthCallbackQueryDto {
  @ApiPropertyOptional({ example: '4/0AQSTgQF...' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({ example: 'access_denied' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  error?: string;

  @ApiPropertyOptional({ example: 'swd_gs_0123456789abcdef' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  state?: string;
}

export class LinkGoogleDto {
  @ApiPropertyOptional({ example: 'swd_gl_0123456789abcdef' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  linkToken?: string;
}
