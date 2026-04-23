import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [AuthModule, IntegrationsModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
