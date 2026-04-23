import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../../modules/auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import {
  WebhookDeliveriesController,
  WebhooksController,
} from './webhooks.controller';
import { WebhookService } from './webhook.service';

@Global()
@Module({
  imports: [AuditModule, AuthModule, DatabaseModule, QueueModule],
  controllers: [WebhooksController, WebhookDeliveriesController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhooksModule {}
