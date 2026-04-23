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
  exportJobs,
  fileAssets,
  organizations,
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
  accessToken: `swd_at_${randomUUID().replace(/-/g, '')}`,
  clientId: randomUUID(),
  exportJobId: randomUUID(),
  fileId: randomUUID(),
  fileStorageKey: `org_${randomUUID().replace(/-/g, '')}/files/${randomUUID()}.pdf`,
  operatorRoleId: randomUUID(),
  organizationId: randomUUID(),
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
  workspaceAId: randomUUID(),
  workspaceBId: randomUUID(),
};

describe('Workspace auth (e2e)', () => {
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

  it('rejects cross-workspace request creation', () => {
    return request(app.getHttpServer())
      .post('/v1/requests')
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .send({
        workspaceId: fixture.workspaceBId,
      })
      .expect(403);
  });

  it('rejects cross-workspace request transitions', () => {
    return request(app.getHttpServer())
      .post(`/v1/requests/${fixture.requestId}/send`)
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .send({})
      .expect(403);
  });

  it('rejects cross-workspace client access', () => {
    return request(app.getHttpServer())
      .get(`/v1/clients/${fixture.clientId}`)
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .expect(403);
  });

  it('rejects cross-workspace client creation', () => {
    return request(app.getHttpServer())
      .post('/v1/clients')
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .send({
        workspaceId: fixture.workspaceBId,
        displayName: 'Forbidden Client',
      })
      .expect(403);
  });

  it('rejects cross-workspace template access', () => {
    return request(app.getHttpServer())
      .get(`/v1/templates/${fixture.templateId}`)
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .expect(403);
  });

  it('rejects cross-workspace template creation', () => {
    return request(app.getHttpServer())
      .post('/v1/templates')
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .send({
        workspaceId: fixture.workspaceBId,
        name: 'Forbidden Template',
        slug: `forbidden-${fixture.templateId.slice(0, 6)}`,
      })
      .expect(403);
  });

  it('rejects cross-workspace submission autosave', () => {
    return request(app.getHttpServer())
      .patch(`/v1/submissions/${fixture.submissionId}/answers`)
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .send({
        answers: [],
      })
      .expect(403);
  });

  it('rejects cross-workspace review actions', () => {
    return request(app.getHttpServer())
      .post(`/v1/reviews/${fixture.submissionItemId}/approve`)
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .send({})
      .expect(403);
  });

  it('rejects cross-workspace file access', () => {
    return request(app.getHttpServer())
      .get(`/v1/files/metadata/${fixture.fileId}`)
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .expect(403);
  });

  it('rejects cross-workspace export access', () => {
    return request(app.getHttpServer())
      .get(`/v1/exports/jobs/${fixture.exportJobId}`)
      .set('Authorization', `Bearer ${fixture.accessToken}`)
      .expect(403);
  });

  afterAll(async () => {
    await cleanupFixture(databaseService);
    await app.close();
  });
});

async function seedFixture(databaseService: DatabaseService): Promise<void> {
  const db = databaseService.db;
  const now = new Date();

  await db.insert(organizations).values({
    id: fixture.organizationId,
    slug: `org-${fixture.organizationId.slice(0, 8)}`,
    displayName: 'Workspace Auth Test Org',
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

  await db.insert(workspaces).values([
    {
      id: fixture.workspaceAId,
      organizationId: fixture.organizationId,
      name: 'Workspace A',
      code: `ws-a-${fixture.workspaceAId.slice(0, 6)}`,
      defaultBrandingId: null,
      defaultReminderPolicyId: null,
      status: 'active',
      createdAt: now,
    },
    {
      id: fixture.workspaceBId,
      organizationId: fixture.organizationId,
      name: 'Workspace B',
      code: `ws-b-${fixture.workspaceBId.slice(0, 6)}`,
      defaultBrandingId: null,
      defaultReminderPolicyId: null,
      status: 'active',
      createdAt: now,
    },
  ]);

  await db.insert(users).values({
    id: fixture.userId,
    email: `operator-${fixture.userId.slice(0, 8)}@swiftydoc.test`,
    fullName: 'Workspace Operator',
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
    workspaceId: fixture.workspaceAId,
    userId: fixture.userId,
    roleId: fixture.operatorRoleId,
    status: 'active',
    createdAt: now,
  });

  await db.insert(userSessions).values({
    id: fixture.sessionId,
    userId: fixture.userId,
    organizationId: fixture.organizationId,
    activeWorkspaceId: fixture.workspaceAId,
    accessTokenHash: hashToken(fixture.accessToken),
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
    workspaceId: fixture.workspaceBId,
    displayName: 'Restricted Client',
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
    workspaceId: fixture.workspaceBId,
    name: 'Restricted Template',
    slug: `restricted-template-${fixture.templateId.slice(0, 6)}`,
    description: null,
    status: 'draft',
    publishedVersionNumber: null,
    createdByUserId: fixture.userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });

  await db.insert(templateVersions).values({
    id: fixture.templateVersionId,
    templateId: fixture.templateId,
    versionNumber: 1,
    status: 'draft',
    changeSummary: null,
    schemaChecksum: null,
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
    fieldKey: `field_${fixture.templateFieldId.slice(0, 6)}`,
    label: 'Passport copy',
    helpText: null,
    fieldType: 'file',
    isRequired: true,
    position: 1,
    options: [],
    validationRules: {},
    conditionalRules: {},
    createdAt: now,
  });

  await db.insert(recipients).values({
    id: fixture.recipientId,
    organizationId: fixture.organizationId,
    clientId: fixture.clientId,
    contactId: null,
    label: 'Primary contact',
    email: `recipient-${fixture.recipientId.slice(0, 8)}@swiftydoc.test`,
    phone: null,
    deliveryChannel: 'email',
    status: 'active',
    createdAt: now,
  });

  await db.insert(requests).values({
    id: fixture.requestId,
    organizationId: fixture.organizationId,
    workspaceId: fixture.workspaceBId,
    clientId: fixture.clientId,
    templateId: fixture.templateId,
    templateVersionId: fixture.templateVersionId,
    requestCode: `REQ-${fixture.requestId.slice(0, 8)}`,
    title: 'Restricted Request',
    message: null,
    status: 'draft',
    dueAt: null,
    sentAt: null,
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

  await db.insert(fileAssets).values({
    id: fixture.fileId,
    organizationId: fixture.organizationId,
    requestId: fixture.requestId,
    submissionId: fixture.submissionId,
    submissionItemId: fixture.submissionItemId,
    storageKey: fixture.fileStorageKey,
    storageDriver: 'local',
    originalFileName: 'passport.pdf',
    normalizedFileName: 'passport.pdf',
    extension: 'pdf',
    declaredMimeType: 'application/pdf',
    detectedMimeType: 'application/pdf',
    sizeBytes: 128,
    checksumSha256: 'a'.repeat(64),
    status: 'active',
    uploadedByType: 'user',
    uploadedById: fixture.userId,
    metadata: {
      workspaceId: fixture.workspaceBId,
    },
    createdAt: now,
    deletedAt: null,
  });

  await db.insert(exportJobs).values({
    id: fixture.exportJobId,
    organizationId: fixture.organizationId,
    requestId: fixture.requestId,
    submissionId: fixture.submissionId,
    type: 'zip',
    status: 'queued',
    artifactStorageKey: null,
    artifactMimeType: null,
    artifactSizeBytes: null,
    requestedByUserId: fixture.userId,
    errorMessage: null,
    metadata: {
      workspaceId: fixture.workspaceBId,
    },
    createdAt: now,
    startedAt: null,
    completedAt: null,
  });
}

async function cleanupFixture(databaseService: DatabaseService): Promise<void> {
  const db = databaseService.db;

  await db.delete(userSessions).where(eq(userSessions.id, fixture.sessionId));
  await db.delete(users).where(eq(users.id, fixture.userId));
  await db
    .delete(organizations)
    .where(eq(organizations.id, fixture.organizationId));
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
