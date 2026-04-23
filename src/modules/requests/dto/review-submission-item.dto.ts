import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReviewSubmissionItemDto {
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
