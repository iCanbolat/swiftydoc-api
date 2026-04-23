import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GoogleDriveIntegrationConnector } from '../../infrastructure/integrations/google-drive-integration.connector';
import { OdooIntegrationConnector } from '../../infrastructure/integrations/odoo-integration.connector';
import { OneDriveSharePointIntegrationConnector } from '../../infrastructure/integrations/onedrive-sharepoint-integration.connector';
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
  imports: [AuthModule],
  controllers: [IntegrationsController, SyncJobsController],
  providers: [
    IntegrationsService,
    WhatsAppCloudIntegrationConnector,
    PlivoIntegrationConnector,
    ResendIntegrationConnector,
    ZohoBooksIntegrationConnector,
    OdooIntegrationConnector,
    GoogleDriveIntegrationConnector,
    OneDriveSharePointIntegrationConnector,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
