import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RequestsModule } from '../requests/requests.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [AuthModule, RequestsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
