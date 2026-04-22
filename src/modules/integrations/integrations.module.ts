import { Module } from '@nestjs/common';
import { PlivoIntegrationConnector } from '../../infrastructure/integrations/plivo-integration.connector';
import { ResendIntegrationConnector } from '../../infrastructure/integrations/resend-integration.connector';
import { WhatsAppCloudIntegrationConnector } from '../../infrastructure/integrations/whatsapp-cloud-integration.connector';
import { ZohoBooksIntegrationConnector } from '../../infrastructure/integrations/zoho-books-integration.connector';
import {
  IntegrationsController,
  SyncJobsController,
} from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  controllers: [IntegrationsController, SyncJobsController],
  providers: [
    IntegrationsService,
    WhatsAppCloudIntegrationConnector,
    PlivoIntegrationConnector,
    ResendIntegrationConnector,
    ZohoBooksIntegrationConnector,
  ],
})
export class IntegrationsModule {}