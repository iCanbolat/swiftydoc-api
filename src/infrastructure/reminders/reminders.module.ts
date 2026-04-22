import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PlivoSmsReminderProvider } from './plivo-sms-reminder.provider';
import { RemindersService } from './reminders.service';
import { ResendEmailReminderProvider } from './resend-email-reminder.provider';
import { WhatsAppCloudReminderProvider } from './whatsapp-cloud-reminder.provider';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    RemindersService,
    WhatsAppCloudReminderProvider,
    PlivoSmsReminderProvider,
    ResendEmailReminderProvider,
  ],
  exports: [RemindersService],
})
export class RemindersModule {}
