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

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const workspaceCodePattern = /^[A-Z0-9]{1,12}-[A-Z]{7}$/;
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
  @MaxLength(64)
  @Matches(slugPattern)
  organizationSlug?: string;

  @ApiPropertyOptional({ example: 'Acme Advisory' })
  @ValidateIf(
    (payload: StartGoogleAuthQueryDto) => payload.intent === 'sign_up',
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  organizationName?: string;

  @ApiPropertyOptional({ example: 'Client Delivery' })
  @ValidateIf(
    (payload: StartGoogleAuthQueryDto) => payload.intent === 'sign_up',
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  workspaceName?: string;

  @ApiPropertyOptional({ example: 'ACME-ABCDEFG' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(workspaceCodePattern)
  workspaceCode?: string;

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
