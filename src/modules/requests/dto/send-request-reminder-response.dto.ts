import { ApiProperty } from '@nestjs/swagger';
import {
  REMINDER_CHANNEL_VALUES,
  REMINDER_PROVIDER_VALUES,
} from '../../../common/reminders/reminder-types';

export class SendRequestReminderResponseDataDto {
  @ApiProperty({ example: 'req_123' })
  requestId!: string;

  @ApiProperty({
    enum: REMINDER_CHANNEL_VALUES,
    enumName: 'ReminderChannel',
    example: 'email',
  })
  channel!: (typeof REMINDER_CHANNEL_VALUES)[number];

  @ApiProperty({
    enum: REMINDER_PROVIDER_VALUES,
    enumName: 'ReminderProvider',
    example: 'resend',
  })
  provider!: (typeof REMINDER_PROVIDER_VALUES)[number];

  @ApiProperty({ example: 'email_abc123' })
  externalMessageId!: string;

  @ApiProperty({ example: '2026-04-22T10:30:00.000Z' })
  acceptedAt!: string;
}

export class SendRequestReminderResponseDto {
  @ApiProperty({ type: () => SendRequestReminderResponseDataDto })
  data!: SendRequestReminderResponseDataDto;
}
