import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { QueueModule } from '../queue/queue.module';
import { WebhooksController } from './webhooks.controller';
import { WebhookService } from './webhook.service';

@Global()
@Module({
  imports: [AuditModule, QueueModule],
  controllers: [WebhooksController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhooksModule {}
