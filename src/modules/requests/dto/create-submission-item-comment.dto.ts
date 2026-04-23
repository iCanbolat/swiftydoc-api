import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSubmissionItemCommentDto {
  @ApiProperty({
    example: 'Bu dosyada dogum tarihi okunmuyor. Yeni bir kopya yukleyin.',
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      channel: 'review-panel',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
