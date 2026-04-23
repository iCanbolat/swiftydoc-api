import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/common/http/configure-http-app';
import { configureOpenApi } from '../src/common/http/configure-openapi';
import { DatabaseService } from '../src/infrastructure/database/database.service';
import {
  clients,
  fileAssets,
  organizations,
  portalLinks,
  recipients,
  requests,
  roles,
  submissionItems,
  submissions,
  templateFields,
  templateSections,
  templateVersions,
  templates,
  userSessions,
  users,
  workspaceMemberships,
  workspaces,
} from '../src/infrastructure/database/schema';

process.env.DATABASE_URL ??= 'postgres://postgres:123@localhost:5432/swiftydoc';

const fixture = {
  clientId: randomUUID(),
  fileName: 'portal-note.txt',
  internalAccessToken: `swd_at_${randomUUID().replace(/-/g, '')}`,
  operatorRoleId: randomUUID(),
  organizationId: randomUUID(),
  portalLinkId: randomUUID(),
  portalLinkToken: `portal_${randomUUID().replace(/-/g, '')}`,
  recipientId: randomUUID(),
  requestId: randomUUID(),
  sectionId: randomUUID(),
  sessionId: randomUUID(),
  submissionId: randomUUID(),
  submissionItemId: randomUUID(),
  templateFieldId: randomUUID(),
  templateId: randomUUID(),
  templateVersionId: randomUUID(),
  userId: randomUUID(),
  workspaceId: randomUUID(),
};

describe('Portal auth boundary (e2e)', () => {
  let app: INestApplication<App>;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApp(app);
    configureOpenApi(app);
    await app.init();

    databaseService = app.get(DatabaseService);
    await seedFixture(databaseService);
  });

  it('issues a portal access token and allows portal autosave', async () => {
    const portalAccessToken = await issuePortalAccessToken(app);

    await request(app.getHttpServer())
      .patch(`/v1/portal/submissions/${fixture.submissionId}/answers`)
      .set('Authorization', `Portal ${portalAccessToken}`)
      .send({
        answers: [
          {
            submissionItemId: fixture.submissionItemId,
            value: {
              text: 'Portal answer',
            },
          },
        ],
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          submissionId: fixture.submissionId,
          status: 'completed',
          progressPercent: 100,
          answeredItems: 1,
        });
      });
  });

  it('allows portal file upload on the portal surface', async () => {
    const portalAccessToken = await issuePortalAccessToken(app);

    await request(app.getHttpServer())
      .post('/v1/portal/files/upload')
      .set('Authorization', `Portal ${portalAccessToken}`)
      .send({
        fileName: fixture.fileName,
        contentBase64: Buffer.from('portal upload').toString('base64'),
        contentType: 'text/plain',
        submissionItemId: fixture.submissionItemId,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data.fileId).toBeTruthy();
        expect(body.data.storageDriver).toBeTruthy();
        expect(body.data.downloadUrl).toContain('/v1/files/download?key=');
      });
  });

  it('rejects portal token on internal admin endpoints', async () => {
    const portalAccessToken = await issuePortalAccessToken(app);

    await request(app.getHttpServer())
      .post(`/v1/requests/${fixture.requestId}/send`)
      .set('Authorization', `Portal ${portalAccessToken}`)
      .send({})
      .expect(401);
  });

  it('rejects internal bearer token on portal endpoints', () => {
    return request(app.getHttpServer())
      .patch(`/v1/portal/submissions/${fixture.submissionId}/answers`)
      .set('Authorization', `Bearer ${fixture.internalAccessToken}`)
      .send({
        answers: [
          {
            submissionItemId: fixture.submissionItemId,
            value: {
              text: 'Wrong surface',
            },
          },
        ],
      })
      .expect(401);
  });

  afterAll(async () => {
    await cleanupFixture(databaseService);
    await app.close();
  });
});

async function issuePortalAccessToken(app: INestApplication<App>) {
  const response = await request(app.getHttpServer())
    .post('/v1/portal/access')
    .send({
      requestId: fixture.requestId,
      token: fixture.portalLinkToken,
      purpose: 'submission_access',
    })
    .expect(201);

  expect(response.body.data.tokenType).toBe('Portal');
  expect(response.body.data.portalAccessToken).toBeTruthy();
  expect(response.body.data.accessTokenExpiresAt).toBeTruthy();

  return response.body.data.portalAccessToken as string;
}

async function seedFixture(databaseService: DatabaseService): Promise<void> {
  const db = databaseService.db;
  const now = new Date();

  await db.insert(organizations).values({
    id: fixture.organizationId,
    slug: `portal-${fixture.organizationId.slice(0, 8)}`,
    displayName: 'Portal Auth Test Org',
    legalName: null,
    defaultLocale: 'en',
    primaryRegion: 'mena',
    timezone: 'UTC',
    planTier: 'foundation',
    dataResidencyPolicy: 'standard',
    status: 'active',
    createdAt: now,
    archivedAt: null,
  });

  await db.insert(workspaces).values({
    id: fixture.workspaceId,
    organizationId: fixture.organizationId,
    name: 'Portal Workspace',
    code: `portal-${fixture.workspaceId.slice(0, 6)}`,
    defaultBrandingId: null,
    defaultReminderPolicyId: null,
    status: 'active',
    createdAt: now,
  });

  await db.insert(users).values({
    id: fixture.userId,
    email: `portal-operator-${fixture.userId.slice(0, 8)}@swiftydoc.test`,
    fullName: 'Portal Operator',
    locale: 'en',
    phone: null,
    status: 'active',
    lastLoginAt: now,
    createdAt: now,
  });

  await db.insert(roles).values({
    id: fixture.operatorRoleId,
    organizationId: fixture.organizationId,
    name: 'workspace_operator',
    isSystemRole: true,
    createdAt: now,
  });

  await db.insert(workspaceMemberships).values({
    id: randomUUID(),
    organizationId: fixture.organizationId,
    workspaceId: fixture.workspaceId,
    userId: fixture.userId,
    roleId: fixture.operatorRoleId,
    status: 'active',
    createdAt: now,
  });

  await db.insert(userSessions).values({
    id: fixture.sessionId,
    userId: fixture.userId,
    organizationId: fixture.organizationId,
    activeWorkspaceId: fixture.workspaceId,
    accessTokenHash: hashToken(fixture.internalAccessToken),
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + 60 * 60_000),
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(clients).values({
    id: fixture.clientId,
    organizationId: fixture.organizationId,
    workspaceId: fixture.workspaceId,
    displayName: 'Portal Client',
    legalName: null,
    externalRef: null,
    status: 'active',
    metadata: {},
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });

  await db.insert(templates).values({
    id: fixture.templateId,
    organizationId: fixture.organizationId,
    workspaceId: fixture.workspaceId,
    name: 'Portal Template',
    slug: `portal-template-${fixture.templateId.slice(0, 6)}`,
    description: null,
    status: 'published',
    publishedVersionNumber: 1,
    createdByUserId: fixture.userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });

  await db.insert(templateVersions).values({
    id: fixture.templateVersionId,
    templateId: fixture.templateId,
    versionNumber: 1,
    status: 'published',
    changeSummary: 'Initial version',
    schemaChecksum: 'checksum',
    createdByUserId: fixture.userId,
    createdAt: now,
  });

  await db.insert(templateSections).values({
    id: fixture.sectionId,
    templateVersionId: fixture.templateVersionId,
    title: 'Identity',
    description: null,
    position: 1,
    isRepeatable: false,
    createdAt: now,
  });

  await db.insert(templateFields).values({
    id: fixture.templateFieldId,
    templateVersionId: fixture.templateVersionId,
    sectionId: fixture.sectionId,
    fieldKey: 'company_name',
    label: 'Company Name',
    helpText: null,
    fieldType: 'text',
    options: [],
    validationRules: {},
    conditionalRules: {},
    isRequired: true,
    position: 1,
    createdAt: now,
  });

  await db.insert(recipients).values({
    id: fixture.recipientId,
    organizationId: fixture.organizationId,
    clientId: fixture.clientId,
    contactId: null,
    label: 'Primary Recipient',
    email: `recipient-${fixture.recipientId.slice(0, 8)}@example.com`,
    phone: null,
    deliveryChannel: 'email',
    status: 'active',
    createdAt: now,
  });

  await db.insert(requests).values({
    id: fixture.requestId,
    organizationId: fixture.organizationId,
    workspaceId: fixture.workspaceId,
    clientId: fixture.clientId,
    templateId: fixture.templateId,
    templateVersionId: fixture.templateVersionId,
    requestCode: `REQ-${fixture.requestId.slice(0, 8)}`,
    title: 'Portal Request',
    message: null,
    status: 'sent',
    dueAt: null,
    sentAt: now,
    closedAt: null,
    overdueNotifiedAt: null,
    createdByUserId: fixture.userId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(submissions).values({
    id: fixture.submissionId,
    organizationId: fixture.organizationId,
    requestId: fixture.requestId,
    recipientId: fixture.recipientId,
    status: 'in_progress',
    progressPercent: 0,
    submittedAt: null,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(submissionItems).values({
    id: fixture.submissionItemId,
    organizationId: fixture.organizationId,
    submissionId: fixture.submissionId,
    templateFieldId: fixture.templateFieldId,
    status: 'pending',
    note: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(portalLinks).values({
    id: fixture.portalLinkId,
    organizationId: fixture.organizationId,
    requestId: fixture.requestId,
    submissionId: fixture.submissionId,
    recipientId: fixture.recipientId,
    purpose: 'submission_access',
    tokenHash: hashToken(fixture.portalLinkToken),
    status: 'active',
    expiresAt: new Date(now.getTime() + 60 * 60_000),
    maxUses: 10,
    usedCount: 0,
    lastUsedAt: null,
    createdByUserId: fixture.userId,
    metadata: {},
    createdAt: now,
    revokedAt: null,
  });
}

async function cleanupFixture(databaseService: DatabaseService): Promise<void> {
  const db = databaseService.db;

  await db
    .delete(fileAssets)
    .where(eq(fileAssets.organizationId, fixture.organizationId));
  await db
    .delete(organizations)
    .where(eq(organizations.id, fixture.organizationId));
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
