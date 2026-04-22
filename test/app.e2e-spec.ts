import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureHttpApp } from './../src/common/http/configure-http-app';
import { configureOpenApi } from './../src/common/http/configure-openapi';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApp(app);
    configureOpenApi(app);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: {
            name: 'swiftydoc-api',
            status: 'ok',
            phase: 'foundation',
            database: {
              driver: 'postgres',
              orm: 'drizzle',
            },
            storage: {
              driver: 'local',
            },
          },
        });
      });
  });

  it('/v1/files/upload (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/files/upload')
      .send({
        fileName: 'passport.pdf',
      })
      .expect(400);
  });

  it('/v1/webhooks/endpoints (POST) rejects unexpected fields', () => {
    return request(app.getHttpServer())
      .post('/v1/webhooks/endpoints')
      .send({
        secret: 'super-secret-token',
        unexpected: true,
        url: 'http://localhost:3001/hooks',
      })
      .expect(400);
  });

  it('/v1/requests/:id/send (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/requests/req_123/send')
      .send({})
      .expect(400);
  });

  it('/v1/requests/:id/remind (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/requests/req_123/remind')
      .send({})
      .expect(400);
  });

  it('/v1/portal/access (POST) rejects missing token payload', () => {
    return request(app.getHttpServer())
      .post('/v1/portal/access')
      .send({
        requestId: 'req_123',
      })
      .expect(400);
  });

  it('/v1/reviews/:itemId/approve (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/reviews/submission_item_123/approve')
      .send({})
      .expect(400);
  });

  it('/v1/reviews/:itemId/comments (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/reviews/submission_item_123/comments')
      .send({
        organizationId: 'org_123',
      })
      .expect(400);
  });

  it('/v1/exports/jobs (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/exports/jobs')
      .send({
        organizationId: 'org_123',
      })
      .expect(400);
  });

  it('/v1/exports/jobs/:id (GET) rejects missing query payload', () => {
    return request(app.getHttpServer())
      .get('/v1/exports/jobs/export_job_123')
      .expect(400);
  });

  it('/v1/exports/jobs/:id/delivery/replay (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/exports/jobs/export_job_123/delivery/replay')
      .send({
        failedOnly: false,
      })
      .expect(400);
  });

  it('/v1/communications/provider-configs (PUT) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .put('/v1/communications/provider-configs')
      .send({
        organizationId: 'org_123',
      })
      .expect(400);
  });

  it('/v1/communications/branding (PUT) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .put('/v1/communications/branding')
      .send({
        organizationId: 'org_123',
      })
      .expect(400);
  });

  it('/v1/communications/email-template-variants (PUT) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .put('/v1/communications/email-template-variants')
      .send({
        organizationId: 'org_123',
      })
      .expect(400);
  });

  it('/v1/integrations/connections (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/integrations/connections')
      .send({
        organizationId: 'org_123',
      })
      .expect(400);
  });

  it('/v1/integrations/connections/:id/test (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/integrations/connections/connection_123/test')
      .send({})
      .expect(400);
  });

  it('/v1/integrations/connections/:id/sync (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/integrations/connections/connection_123/sync')
      .send({})
      .expect(400);
  });

  it('/v1/sync-jobs (GET) rejects missing query payload', () => {
    return request(app.getHttpServer()).get('/v1/sync-jobs').expect(400);
  });

  it('/docs-json (GET) exposes typed webhook enums in the OpenAPI document', () => {
    return request(app.getHttpServer())
      .get('/docs-json')
      .expect(200)
      .expect(({ body }) => {
        expect(body.paths['/v1/webhooks/events']).toBeDefined();
        expect(body.paths['/v1/requests/{id}/send']).toBeDefined();
        expect(body.paths['/v1/requests/{id}/remind']).toBeDefined();
        expect(body.paths['/v1/requests/{id}/portal-links']).toBeDefined();
        expect(body.paths['/v1/submissions/{id}/answers']).toBeDefined();
        expect(body.paths['/v1/portal/access']).toBeDefined();
        expect(body.paths['/v1/reviews/{itemId}/approve']).toBeDefined();
        expect(body.paths['/v1/reviews/{itemId}/reject']).toBeDefined();
        expect(body.paths['/v1/reviews/{itemId}/comments']).toBeDefined();
        expect(body.paths['/v1/exports/jobs']).toBeDefined();
        expect(body.paths['/v1/exports/jobs/{id}']).toBeDefined();
        expect(
          body.paths['/v1/exports/jobs/{id}/delivery/replay'],
        ).toBeDefined();
        expect(body.paths['/v1/communications/provider-configs']).toBeDefined();
        expect(body.paths['/v1/communications/branding']).toBeDefined();
        expect(
          body.paths['/v1/communications/email-template-variants'],
        ).toBeDefined();
        expect(body.paths['/v1/integrations/providers']).toBeDefined();
        expect(body.paths['/v1/integrations/connections']).toBeDefined();
        expect(body.paths['/v1/integrations/connections/{id}']).toBeDefined();
        expect(
          body.paths['/v1/integrations/connections/{id}/test'],
        ).toBeDefined();
        expect(
          body.paths['/v1/integrations/connections/{id}/sync'],
        ).toBeDefined();
        expect(body.paths['/v1/sync-jobs']).toBeDefined();

        const eventTypeEnum =
          body.components.schemas.EmitWebhookEventDto.properties.eventType
            .enum ?? body.components.schemas.WebhookEventType?.enum;
        const subscribedEventsEnum =
          body.components.schemas.RegisterWebhookEndpointDto.properties
            .subscribedEvents.items?.enum ??
          body.components.schemas.WebhookSubscriptionType?.enum;
        const requestStatusEnum =
          body.components.schemas.CreateRequestResponseDataDto.properties.status
            .enum ?? body.components.schemas.RequestStatus?.enum;
        const portalPurposeEnum =
          body.components.schemas.CreatePortalLinkDto.properties.purpose.enum ??
          body.components.schemas.PortalLinkPurpose?.enum;
        const submissionStatusEnum =
          body.components.schemas.AutosaveSubmissionResponseDataDto.properties
            .status.enum ?? body.components.schemas.SubmissionStatus?.enum;
        const reviewDecisionEnum =
          body.components.schemas.ReviewSubmissionItemResponseDataDto.properties
            .decision.enum ?? body.components.schemas.ReviewDecisionType?.enum;
        const commentAuthorTypeEnum =
          body.components.schemas.CreateSubmissionItemCommentDto.properties
            .authorType.enum ?? body.components.schemas.CommentAuthorType?.enum;
        const exportTypeEnum =
          body.components.schemas.CreateExportJobDto.properties.exportType
            .enum ?? body.components.schemas.ExportJobType?.enum;
        const exportStatusEnum =
          body.components.schemas.ExportJobResponseDataDto.properties.status
            .enum ?? body.components.schemas.ExportJobStatus?.enum;
        const exportDeliveryStatusEnum =
          body.components.schemas.ExportJobResponseDataDto.properties
            .deliveryStatus.enum ??
          body.components.schemas.ExportArtifactDeliveryStatus?.enum;
        const reminderChannelEnum =
          body.components.schemas.SendRequestReminderDto.properties.channel
            .enum ?? body.components.schemas.ReminderChannel?.enum;
        const reminderProviderEnum =
          body.components.schemas.UpsertReminderProviderConfigDto.properties
            .provider.enum ?? body.components.schemas.ReminderProvider?.enum;
        const integrationProviderEnum =
          body.components.schemas.CreateIntegrationConnectionDto.properties
            .providerKey.enum ??
          body.components.schemas.IntegrationProviderKey?.enum;
        const integrationAuthTypeEnum =
          body.components.schemas.CreateIntegrationConnectionDto.properties
            .authType.enum ?? body.components.schemas.IntegrationAuthType?.enum;
        const syncJobStatusEnum =
          body.components.schemas.TriggerSyncJobResponseDataDto.properties
            .status.enum ?? body.components.schemas.SyncJobStatus?.enum;
        const triggerSyncPayloadExample =
          body.components.schemas.TriggerSyncJobDto.properties.payload.example;
        const createExportDeliveryTargetsExample =
          body.components.schemas.CreateExportJobDto.properties.deliveryTargets
            .example;
        const exportJobMetadataExample =
          body.components.schemas.CreateExportJobDto.properties.metadata
            .example;
        const replayExportDeliveryFailedOnlyDefault =
          body.components.schemas.ReplayExportDeliveryDto.properties.failedOnly
            .default;
        const exportJobResponseDeliveryTargets =
          body.components.schemas.ExportJobResponseDataDto.properties
            .deliveryTargets;

        expect(eventTypeEnum).toContain('file.uploaded');
        expect(eventTypeEnum).toContain('request.viewed');
        expect(eventTypeEnum).toContain('request.completed');
        expect(eventTypeEnum).toContain('request.overdue');
        expect(eventTypeEnum).toContain('request.reminder_sent');
        expect(subscribedEventsEnum).toContain('*');
        expect(requestStatusEnum).toContain('closed');
        expect(portalPurposeEnum).toContain('request_access');
        expect(submissionStatusEnum).toContain('completed');
        expect(reviewDecisionEnum).toContain('approved');
        expect(commentAuthorTypeEnum).toContain('reviewer');
        expect(exportTypeEnum).toContain('zip');
        expect(exportStatusEnum).toContain('processing');
        expect(exportDeliveryStatusEnum).toContain('delivered');
        expect(reminderChannelEnum).toContain('whatsapp');
        expect(reminderProviderEnum).toContain('resend');
        expect(integrationProviderEnum).toContain('whatsapp_cloud_api');
        expect(integrationProviderEnum).toContain('plivo');
        expect(integrationProviderEnum).toContain('resend');
        expect(integrationProviderEnum).toContain('zoho_books');
        expect(integrationProviderEnum).toContain('google_drive');
        expect(integrationProviderEnum).toContain('onedrive_sharepoint');
        expect(integrationAuthTypeEnum).toContain('bearer_token');
        expect(integrationAuthTypeEnum).toContain('oauth2');
        expect(syncJobStatusEnum).toContain('succeeded');
        expect(triggerSyncPayloadExample.domain).toBe('storage');
        expect(triggerSyncPayloadExample.entityType).toBe('export_artifact');
        expect(createExportDeliveryTargetsExample[0].connectionId).toBe(
          'integration_connection_drive_123',
        );
        expect(exportJobMetadataExample.deliveryTargets).toBeUndefined();
        expect(replayExportDeliveryFailedOnlyDefault).toBe(true);
        expect(exportJobResponseDeliveryTargets.type).toBe('array');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
