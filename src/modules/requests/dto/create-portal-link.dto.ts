import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PORTAL_LINK_PURPOSE_VALUES,
  type PortalLinkPurpose,
} from '../../../common/portal/portal-link-types';

export class CreatePortalLinkDto {
  @ApiPropertyOptional({
    enum: PORTAL_LINK_PURPOSE_VALUES,
    enumName: 'PortalLinkPurpose',
    example: 'request_access',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(PORTAL_LINK_PURPOSE_VALUES)
  purpose?: PortalLinkPurpose;

  @ApiPropertyOptional({ example: 'submission_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  submissionId?: string;

  @ApiPropertyOptional({ example: 'recipient_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  recipientId?: string;

  @ApiPropertyOptional({ example: 10080, minimum: 1, maximum: 43200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(43200)
  expiresInMinutes?: number;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      channel: 'email',
      locale: 'en',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
