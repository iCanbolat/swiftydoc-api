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

  it('/v1/files/upload (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/files/upload')
      .send({
        fileName: 'passport.pdf',
      })
      .expect(401);
  });

  it('/v1/files/metadata/:id (GET) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .get('/v1/files/metadata/file_123')
      .expect(401);
  });

  it('/v1/files/download-link (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/files/download-link')
      .send({
        storageKey: 'org_123/2026-04-21/file.pdf',
      })
      .expect(401);
  });

  it('/v1/files/download (GET) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .get('/v1/files/download?key=org_123%2F2026-04-21%2Ffile.pdf')
      .expect(401);
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

  it('/v1/webhook-deliveries (GET) rejects missing query payload', () => {
    return request(app.getHttpServer())
      .get('/v1/webhook-deliveries')
      .expect(400);
  });

  it('/v1/webhook-deliveries/:id/replay (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/webhook-deliveries/webhook_delivery_123/replay')
      .send({})
      .expect(400);
  });

  it('/v1/applications (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/applications')
      .send({
        name: 'Partner App',
      })
      .expect(401);
  });

  it('/v1/applications (GET) rejects missing bearer token', () => {
    return request(app.getHttpServer()).get('/v1/applications').expect(401);
  });

  it('/v1/clients (GET) rejects missing bearer token', () => {
    return request(app.getHttpServer()).get('/v1/clients').expect(401);
  });

  it('/v1/clients (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/clients')
      .send({
        workspaceId: 'ws_123',
        displayName: 'Acme LLC',
      })
      .expect(401);
  });

  it('/v1/clients/:id (GET) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .get('/v1/clients/client_123')
      .expect(401);
  });

  it('/v1/clients/:id (PATCH) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .patch('/v1/clients/client_123')
      .send({
        displayName: 'Acme Holdings',
      })
      .expect(401);
  });

  it('/v1/templates (GET) rejects missing bearer token', () => {
    return request(app.getHttpServer()).get('/v1/templates').expect(401);
  });

  it('/v1/templates (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/templates')
      .send({
        workspaceId: 'ws_123',
        name: 'Onboarding Template',
        slug: 'onboarding-template',
      })
      .expect(401);
  });

  it('/v1/templates/:id (GET) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .get('/v1/templates/tpl_123')
      .expect(401);
  });

  it('/v1/templates/:id (PATCH) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .patch('/v1/templates/tpl_123')
      .send({
        name: 'Updated Template',
      })
      .expect(401);
  });

  it('/v1/portal/submissions/:id/answers rejects missing portal token', () => {
    return request(app.getHttpServer())
      .patch('/v1/portal/submissions/submission_123/answers')
      .send({
        answers: [
          {
            submissionItemId: 'submission_item_123',
            value: { text: 'hello' },
          },
        ],
      })
      .expect(401);
  });

  it('/v1/portal/files/upload rejects missing portal token', () => {
    return request(app.getHttpServer())
      .post('/v1/portal/files/upload')
      .send({
        fileName: 'note.txt',
        contentBase64: Buffer.from('hello').toString('base64'),
      })
      .expect(401);
  });

  it('/v1/auth/bootstrap-owner (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/auth/bootstrap-owner')
      .send({
        organizationName: 'Acme',
      })
      .expect(400);
  });

  it('/v1/auth/sign-in (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/auth/sign-in')
      .send({
        organizationSlug: 'acme',
      })
      .expect(400);
  });

  it('/v1/auth/refresh (POST) rejects invalid dto payload', () => {
    return request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({})
      .expect(400);
  });

  it('/v1/auth/me (GET) rejects missing bearer token', () => {
    return request(app.getHttpServer()).get('/v1/auth/me').expect(401);
  });

  it('/v1/auth/sign-out (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer()).post('/v1/auth/sign-out').expect(401);
  });

  it('/v1/applications/:id (GET) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .get('/v1/applications/oauth_app_123')
      .expect(401);
  });

  it('/v1/applications/:id (PATCH) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .patch('/v1/applications/oauth_app_123')
      .send({
        name: 'Renamed App',
      })
      .expect(401);
  });

  it('/v1/applications/:id/rotate-secret (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/applications/oauth_app_123/rotate-secret')
      .send({
        reason: 'quarterly rotation',
      })
      .expect(401);
  });

  it('/v1/requests (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/requests')
      .send({
        workspaceId: 'ws_123',
      })
      .expect(401);
  });

  it('/v1/requests/:id/send (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/requests/req_123/send')
      .send({})
      .expect(401);
  });

  it('/v1/requests/:id/remind (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/requests/req_123/remind')
      .send({})
      .expect(401);
  });

  it('/v1/requests/:id/portal-links (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/requests/req_123/portal-links')
      .send({})
      .expect(401);
  });

  it('/v1/submissions/:id/answers (PATCH) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .patch('/v1/submissions/submission_123/answers')
      .send({})
      .expect(401);
  });

  it('/v1/portal/access (POST) rejects missing token payload', () => {
    return request(app.getHttpServer())
      .post('/v1/portal/access')
      .send({
        requestId: 'req_123',
      })
      .expect(400);
  });

  it('/v1/reviews/:itemId/approve (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/reviews/submission_item_123/approve')
      .send({})
      .expect(401);
  });

  it('/v1/reviews/:itemId/comments (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/reviews/submission_item_123/comments')
      .send({
        body: 'Need another copy.',
      })
      .expect(401);
  });

  it('/v1/exports/jobs (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/exports/jobs')
      .send({
        exportType: 'zip',
      })
      .expect(401);
  });

  it('/v1/exports/jobs/:id (GET) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .get('/v1/exports/jobs/export_job_123')
      .expect(401);
  });

  it('/v1/exports/jobs/:id/delivery/replay (POST) rejects missing bearer token', () => {
    return request(app.getHttpServer())
      .post('/v1/exports/jobs/export_job_123/delivery/replay')
      .send({
        failedOnly: false,
      })
      .expect(401);
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

  it('/v1/integrations/connections/:id/debug (GET) rejects missing query payload', () => {
    return request(app.getHttpServer())
      .get('/v1/integrations/connections/connection_123/debug')
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
        expect(body.paths['/v1/webhook-deliveries']).toBeDefined();
        expect(body.paths['/v1/webhook-deliveries/{id}/replay']).toBeDefined();
        expect(body.paths['/v1/applications']).toBeDefined();
        expect(body.paths['/v1/clients']).toBeDefined();
        expect(body.paths['/v1/clients/{id}']).toBeDefined();
        expect(body.paths['/v1/auth/bootstrap-owner']).toBeDefined();
        expect(body.paths['/v1/auth/sign-in']).toBeDefined();
        expect(body.paths['/v1/auth/refresh']).toBeDefined();
        expect(body.paths['/v1/auth/me']).toBeDefined();
        expect(body.paths['/v1/auth/sign-out']).toBeDefined();
        expect(body.paths['/v1/applications/{id}']).toBeDefined();
        expect(body.paths['/v1/applications/{id}/rotate-secret']).toBeDefined();
        expect(body.paths['/v1/templates']).toBeDefined();
        expect(body.paths['/v1/templates/{id}']).toBeDefined();
        expect(body.paths['/v1/portal/submissions/{id}/answers']).toBeDefined();
        expect(body.paths['/v1/portal/files/upload']).toBeDefined();
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
          body.paths['/v1/integrations/connections/{id}/debug'],
        ).toBeDefined();
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
        const oauthApplicationTypeEnum =
          body.components.schemas.OAuthApplicationDataDto.properties
            .applicationType.enum ??
          body.components.schemas.OAuthApplicationType?.enum;
        const oauthApplicationStatusEnum =
          body.components.schemas.OAuthApplicationDataDto.properties.status
            .enum ?? body.components.schemas.OAuthApplicationStatus?.enum;
        const authBearerScheme = body.components.securitySchemes?.bearer;
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
          body.components.schemas.CreateSubmissionItemCommentResponseDataDto
            ?.properties.authorType.enum ??
          body.components.schemas.CommentAuthorType?.enum;
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
        const webhookDeliveryStatusEnum =
          body.components.schemas.WebhookDeliveryViewDto.properties.status
            .enum ?? body.components.schemas.WebhookDeliveryStatus?.enum;

        expect(eventTypeEnum).toContain('file.uploaded');
        expect(eventTypeEnum).toContain('request.viewed');
        expect(eventTypeEnum).toContain('request.completed');
        expect(eventTypeEnum).toContain('request.overdue');
        expect(eventTypeEnum).toContain('request.reminder_sent');
        expect(authBearerScheme?.scheme).toBe('bearer');
        expect(subscribedEventsEnum).toContain('*');
        expect(oauthApplicationTypeEnum).toContain('confidential');
        expect(oauthApplicationStatusEnum).toContain('revoked');
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
        expect(webhookDeliveryStatusEnum).toContain('failed');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
