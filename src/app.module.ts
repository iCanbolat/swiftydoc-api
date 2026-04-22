import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateRuntimeEnv } from './common/config/runtime-env';
import { AuditModule } from './infrastructure/audit/audit.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RemindersModule } from './infrastructure/reminders/reminders.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { WebhooksModule } from './infrastructure/webhooks/webhooks.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { ExportsModule } from './modules/exports/exports.module';
import { FilesModule } from './modules/files/files.module';
import { RequestsModule } from './modules/requests/requests.module';
import type { RuntimeEnv } from './common/config/runtime-env';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateRuntimeEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<RuntimeEnv, true>) => [
        {
          ttl: configService.get('RATE_LIMIT_TTL_MS', { infer: true }),
          limit: configService.get('RATE_LIMIT_MAX', { infer: true }),
        },
      ],
    }),
    AuditModule,
    DatabaseModule,
    QueueModule,
    RemindersModule,
    StorageModule,
    WebhooksModule,
    CommunicationsModule,
    ExportsModule,
    FilesModule,
    RequestsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
