import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  REMINDER_CHANNEL_VALUES,
  type ReminderChannel,
} from '../../../common/reminders/reminder-types';

export class SendRequestReminderDto {
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

  @ApiProperty({
    enum: REMINDER_CHANNEL_VALUES,
    enumName: 'ReminderChannel',
    example: 'whatsapp',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(REMINDER_CHANNEL_VALUES)
  channel!: ReminderChannel;

  @ApiProperty({
    example: '+971500001111',
    description: 'Email address or phone number depending on selected channel.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  recipient!: string;

  @ApiPropertyOptional({ example: 'Reminder: REQ-2026-001 is waiting' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  subject?: string;

  @ApiPropertyOptional({
    example: 'Please complete your request using the secure link.',
  })
  @ValidateIf((payload: SendRequestReminderDto) => !payload.templateKey)
  @IsString()
  @IsNotEmpty()
  message?: string;

  @ApiPropertyOptional({ example: 'request_reminder' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  templateKey?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      clientName: 'Acme LLC',
      requestCode: 'REQ-2026-001',
    },
  })
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  locale?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      source: 'manual_reminder',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
