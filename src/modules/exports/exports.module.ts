import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
