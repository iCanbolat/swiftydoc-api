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

  it('/docs-json (GET) exposes typed webhook enums in the OpenAPI document', () => {
    return request(app.getHttpServer())
      .get('/docs-json')
      .expect(200)
      .expect(({ body }) => {
        expect(body.paths['/v1/webhooks/events']).toBeDefined();

        const eventTypeEnum =
          body.components.schemas.EmitWebhookEventDto.properties.eventType
            .enum ?? body.components.schemas.WebhookEventType?.enum;
        const subscribedEventsEnum =
          body.components.schemas.RegisterWebhookEndpointDto.properties
            .subscribedEvents.items?.enum ??
          body.components.schemas.WebhookSubscriptionType?.enum;

        expect(eventTypeEnum).toContain('file.uploaded');
        expect(subscribedEventsEnum).toContain('*');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
