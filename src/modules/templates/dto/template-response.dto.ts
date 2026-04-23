import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TEMPLATE_STATUS_VALUES } from '../templates.types';

export class TemplateDataDto {
  @ApiProperty({ example: 'tpl_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiProperty({ example: 'ws_123' })
  workspaceId!: string;

  @ApiProperty({ example: 'KYC Onboarding' })
  name!: string;

  @ApiProperty({ example: 'kyc-onboarding' })
  slug!: string;

  @ApiPropertyOptional({
    example: 'Collect core onboarding documents.',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    enum: TEMPLATE_STATUS_VALUES,
    enumName: 'TemplateStatus',
    example: 'draft',
  })
  status!: (typeof TEMPLATE_STATUS_VALUES)[number];

  @ApiPropertyOptional({ example: 3, nullable: true })
  publishedVersionNumber!: number | null;

  @ApiPropertyOptional({ example: 'user_123', nullable: true })
  createdByUserId!: string | null;

  @ApiProperty({ example: '2026-04-23T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-23T10:00:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  archivedAt!: string | null;
}

export class TemplateResponseDto {
  @ApiProperty({ type: () => TemplateDataDto })
  data!: TemplateDataDto;
}

export class TemplateListResponseDto {
  @ApiProperty({ type: () => TemplateDataDto, isArray: true })
  data!: TemplateDataDto[];
}
