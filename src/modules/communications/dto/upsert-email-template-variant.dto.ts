import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertEmailTemplateVariantDto {
  @ApiProperty({ example: 'org_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId!: string;

  @ApiPropertyOptional({ example: 'user_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  actorUserId?: string;

  @ApiProperty({ example: 'request_reminder' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  templateKey!: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  locale?: string;

  @ApiPropertyOptional({ example: 'tpl_123456' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  resendTemplateId?: string;

  @ApiProperty({ example: 'Reminder: {{requestCode}} is waiting' })
  @IsString()
  @IsNotEmpty()
  subjectTemplate!: string;

  @ApiProperty({
    example:
      'Hi {{clientName}}, please complete request {{requestCode}} using your secure link.',
  })
  @IsString()
  @IsNotEmpty()
  bodyTemplate!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      audience: 'default',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
