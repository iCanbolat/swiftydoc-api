import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { JobQueueService } from './job-queue.service';

@Global()
@Module({
  imports: [AuditModule],
  providers: [JobQueueService],
  exports: [JobQueueService],
})
export class QueueModule {}
