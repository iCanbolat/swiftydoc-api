import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBase64,
  IsMimeType,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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
