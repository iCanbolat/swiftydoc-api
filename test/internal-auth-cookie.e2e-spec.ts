import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
} from 'node:crypto';
import { promisify } from 'node:util';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/common/http/configure-http-app';
import { configureOpenApi } from '../src/common/http/configure-openapi';
import { DatabaseService } from '../src/infrastructure/database/database.service';
import {
  authIdentities,
  organizations,
  refreshTokens,
  roles,
  userSessions,
  users,
  workspaceMemberships,
  workspaces,
} from '../src/infrastructure/database/schema';

process.env.DATABASE_URL ??= 'postgres://postgres:123@localhost:5432/swiftydoc';

const scrypt = promisify(scryptCallback);
const TEST_ORIGIN = 'http://localhost:5173';
const REFRESH_COOKIE_NAME = 'swd_refresh_token';
const TEST_PASSWORD = 'Password123!';

function createFixture() {
  return {
    organizationId: randomUUID(),
    roleId: randomUUID(),
    userId: randomUUID(),
    workspaceId: randomUUID(),
  };
}

describe('Internal auth refresh cookie contract (e2e)', () => {
  let app: INestApplication<App>;
  let databaseService: DatabaseService;
  let fixture: ReturnType<typeof createFixture>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApp(app);
    configureOpenApi(app);
    await app.init();

    databaseService = app.get(DatabaseService);
    fixture = createFixture();
    await seedFixture(databaseService, fixture);
  });

  afterAll(async () => {
    await cleanupFixture(databaseService, fixture);
    await app.close();
  });

  it('returns access token JSON without refresh token and sets refresh cookie on sign-in', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/sign-in')
      .send({
        email: buildEmail(fixture.userId),
        password: TEST_PASSWORD,
      })
      .expect(200);

    expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(response.body.data.tokens.refreshToken).toBeUndefined();
    expect(response.body.data.tokens.tokenType).toBe('Bearer');

    const refreshCookie = readCookieValue(
      response.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );

    expect(refreshCookie).toEqual(expect.any(String));
    expect(
      findCookieHeader(response.headers['set-cookie'], REFRESH_COOKIE_NAME),
    ).toContain('HttpOnly');
  });

  it('rejects refresh token body input and refreshes only from cookie with rotation', async () => {
    const signInResponse = await request(app.getHttpServer())
      .post('/v1/auth/sign-in')
      .send({
        email: buildEmail(fixture.userId),
        password: TEST_PASSWORD,
      })
      .expect(200);

    const initialRefreshToken = requireCookieValue(
      signInResponse.headers['set-cookie'],
    );
    const initialAccessToken = signInResponse.body.data.tokens
      .accessToken as string;

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Origin', TEST_ORIGIN)
      .send({ refreshToken: initialRefreshToken })
      .expect(401);

    const refreshResponse = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${initialRefreshToken}`)
      .expect(200);

    expect(refreshResponse.body.data.tokens.accessToken).toEqual(
      expect.any(String),
    );
    expect(refreshResponse.body.data.tokens.refreshToken).toBeUndefined();
    expect(refreshResponse.body.data.tokens.accessToken).not.toBe(
      initialAccessToken,
    );

    const rotatedRefreshToken = requireCookieValue(
      refreshResponse.headers['set-cookie'],
    );
    expect(rotatedRefreshToken).not.toBe(initialRefreshToken);

    const db = databaseService.db;
    const oldTokenHash = hashToken(initialRefreshToken);
    const newTokenHash = hashToken(rotatedRefreshToken);
    const [consumedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, oldTokenHash))
      .limit(1);
    const [rotatedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, newTokenHash))
      .limit(1);

    expect(consumedToken?.consumedAt).not.toBeNull();
    expect(consumedToken?.replacedByTokenId).toBe(rotatedToken?.id ?? null);
    expect(consumedToken?.familyId).toBe(rotatedToken?.familyId);

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${initialRefreshToken}`)
      .expect(401);

    const familyRows = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.familyId, consumedToken!.familyId));

    expect(familyRows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it('clears refresh cookie on sign-out and revokes session refresh', async () => {
    const signInResponse = await request(app.getHttpServer())
      .post('/v1/auth/sign-in')
      .send({
        email: buildEmail(fixture.userId),
        password: TEST_PASSWORD,
      })
      .expect(200);

    const accessToken = signInResponse.body.data.tokens.accessToken as string;
    const refreshToken = requireCookieValue(
      signInResponse.headers['set-cookie'],
    );

    const signOutResponse = await request(app.getHttpServer())
      .post('/v1/auth/sign-out')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`)
      .expect(200);

    expect(
      findCookieHeader(
        signOutResponse.headers['set-cookie'],
        REFRESH_COOKIE_NAME,
      ),
    ).toEqual(expect.stringContaining(`${REFRESH_COOKIE_NAME}=;`));

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`)
      .expect(401);

    const sessions = await databaseService.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.accessTokenHash, hashToken(accessToken)));

    expect(sessions[0]?.revokedAt).not.toBeNull();
  });
});

async function seedFixture(
  databaseService: DatabaseService,
  fixture: ReturnType<typeof createFixture>,
): Promise<void> {
  const db = databaseService.db;
  const now = new Date();

  await db.insert(organizations).values({
    id: fixture.organizationId,
    slug: `auth-cookie-${fixture.organizationId.slice(0, 8)}`,
    displayName: 'Auth Cookie Test Org',
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
    name: 'Primary Workspace',
    code: `AUTH-${fixture.workspaceId.slice(0, 5).toUpperCase()}`,
    defaultBrandingId: null,
    defaultReminderPolicyId: null,
    status: 'active',
    createdAt: now,
  });

  await db.insert(users).values({
    id: fixture.userId,
    email: buildEmail(fixture.userId),
    fullName: 'Cookie Test User',
    locale: 'en',
    phone: null,
    status: 'active',
    lastLoginAt: now,
    createdAt: now,
  });

  await db.insert(roles).values({
    id: fixture.roleId,
    organizationId: fixture.organizationId,
    name: 'organization_owner',
    isSystemRole: true,
    createdAt: now,
  });

  await db.insert(workspaceMemberships).values({
    id: randomUUID(),
    organizationId: fixture.organizationId,
    workspaceId: fixture.workspaceId,
    userId: fixture.userId,
    roleId: fixture.roleId,
    status: 'active',
    createdAt: now,
  });

  await db.insert(authIdentities).values({
    id: randomUUID(),
    userId: fixture.userId,
    provider: 'password',
    providerSubject: buildEmail(fixture.userId),
    passwordHash: await hashPassword(TEST_PASSWORD),
    emailVerifiedAt: now,
    lastAuthenticatedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

async function cleanupFixture(
  databaseService: DatabaseService,
  fixture: ReturnType<typeof createFixture>,
): Promise<void> {
  const db = databaseService.db;

  await db.delete(users).where(eq(users.id, fixture.userId));
  await db
    .delete(organizations)
    .where(eq(organizations.id, fixture.organizationId));
}

function buildEmail(userId: string): string {
  return `cookie-user-${userId.slice(0, 8)}@swiftydoc.test`;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function findCookieHeader(
  setCookie: string[] | string | undefined,
  cookieName: string,
): string | undefined {
  const cookies = Array.isArray(setCookie)
    ? setCookie
    : setCookie
      ? [setCookie]
      : [];
  return cookies.find((entry) => entry.startsWith(`${cookieName}=`));
}

function readCookieValue(
  setCookie: string[] | string | undefined,
  cookieName: string,
): string | null {
  const cookieHeader = findCookieHeader(setCookie, cookieName);

  if (!cookieHeader) {
    return null;
  }

  return cookieHeader.slice(`${cookieName}=`.length).split(';', 1)[0] ?? null;
}

function requireCookieValue(setCookie: string[] | string | undefined): string {
  const cookieValue = readCookieValue(setCookie, REFRESH_COOKIE_NAME);

  if (!cookieValue) {
    throw new Error('Expected refresh cookie to be present.');
  }

  return cookieValue;
}
