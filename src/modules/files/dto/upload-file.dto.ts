import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBase64,
  IsIn,
  IsMimeType,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const UPLOADED_BY_TYPE_VALUES = ['user', 'recipient', 'system'] as const;

export class UploadFileDto {
  @ApiProperty({ example: 'passport.pdf', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    example: 'JVBERi0xLjQKJcfsj6IKMSAwIG9iago8PAovVGl0bGUgKP7/...',
    description: 'Base64-encoded file contents.',
  })
  @IsString()
  @IsNotEmpty()
  @IsBase64()
  contentBase64!: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  @IsMimeType()
  contentType?: string;

  @ApiProperty({ example: 'org_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId!: string;

  @ApiPropertyOptional({ example: 'req_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  requestId?: string;

  @ApiPropertyOptional({ example: 'submission_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  submissionId?: string;

  @ApiPropertyOptional({ example: 'submission_item_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  submissionItemId?: string;

  @ApiPropertyOptional({
    enum: UPLOADED_BY_TYPE_VALUES,
    enumName: 'UploadedByType',
    example: 'user',
    default: 'system',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(UPLOADED_BY_TYPE_VALUES)
  uploadedByType?: (typeof UPLOADED_BY_TYPE_VALUES)[number];

  @ApiPropertyOptional({ example: 'user_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  uploadedById?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      source: 'portal',
      locale: 'en',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
