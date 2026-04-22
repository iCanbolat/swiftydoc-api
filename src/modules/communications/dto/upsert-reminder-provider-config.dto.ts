import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  REMINDER_CHANNEL_VALUES,
  REMINDER_PROVIDER_VALUES,
  type ReminderChannel,
  type ReminderProvider,
} from '../../../common/reminders/reminder-types';

export class UpsertReminderProviderConfigDto {
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
    enum: REMINDER_PROVIDER_VALUES,
    enumName: 'ReminderProvider',
    example: 'whatsapp_cloud_api',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(REMINDER_PROVIDER_VALUES)
  provider!: ReminderProvider;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      phoneNumberId: '1234567890',
      accessToken: 'token_***',
    },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
