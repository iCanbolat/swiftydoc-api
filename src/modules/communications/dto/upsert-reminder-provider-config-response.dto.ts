import { ApiProperty } from '@nestjs/swagger';
import {
  REMINDER_CHANNEL_VALUES,
  REMINDER_PROVIDER_VALUES,
} from '../../../common/reminders/reminder-types';

export class UpsertReminderProviderConfigResponseDataDto {
  @ApiProperty({ example: 'rpc_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiProperty({
    enum: REMINDER_CHANNEL_VALUES,
    enumName: 'ReminderChannel',
    example: 'sms',
  })
  channel!: (typeof REMINDER_CHANNEL_VALUES)[number];

  @ApiProperty({
    enum: REMINDER_PROVIDER_VALUES,
    enumName: 'ReminderProvider',
    example: 'plivo',
  })
  provider!: (typeof REMINDER_PROVIDER_VALUES)[number];

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: '2026-04-22T10:30:00.000Z' })
  updatedAt!: string;
}

export class UpsertReminderProviderConfigResponseDto {
  @ApiProperty({ type: () => UpsertReminderProviderConfigResponseDataDto })
  data!: UpsertReminderProviderConfigResponseDataDto;
}
