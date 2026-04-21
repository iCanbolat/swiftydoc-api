import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBase64,
  IsMimeType,
  IsNotEmpty,
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

  @ApiPropertyOptional({ example: 'org_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId?: string;
}
