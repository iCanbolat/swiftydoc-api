import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const COMMENT_AUTHOR_TYPE_VALUES = ['reviewer', 'recipient', 'system'] as const;

export class CreateSubmissionItemCommentDto {
  @ApiProperty({ example: 'org_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId!: string;

  @ApiProperty({
    example: 'Bu dosyada dogum tarihi okunmuyor. Yeni bir kopya yukleyin.',
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional({
    enum: COMMENT_AUTHOR_TYPE_VALUES,
    enumName: 'CommentAuthorType',
    example: 'reviewer',
    default: 'reviewer',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(COMMENT_AUTHOR_TYPE_VALUES)
  authorType?: (typeof COMMENT_AUTHOR_TYPE_VALUES)[number];

  @ApiPropertyOptional({ example: 'reviewer_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  authorId?: string;

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
