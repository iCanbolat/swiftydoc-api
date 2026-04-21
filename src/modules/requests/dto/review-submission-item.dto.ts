import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReviewSubmissionItemDto {
  @ApiProperty({ example: 'org_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId!: string;

  @ApiPropertyOptional({ example: 'reviewer_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  reviewerId?: string;

  @ApiPropertyOptional({
    example: 'Uploaded ID copy is blurry. Please upload a clearer scan.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      source: 'review_panel',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
