import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { AuditEventsController } from './audit.controller';
import { AuditLogService } from './audit-log.service';
import { RequestAuditContextInterceptor } from './request-audit-context.interceptor';
import { RequestAuditContextService } from './request-audit-context.service';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [AuditEventsController],
  providers: [
    AuditLogService,
    RequestAuditContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestAuditContextInterceptor,
    },
  ],
  exports: [AuditLogService],
})
export class AuditModule {}
