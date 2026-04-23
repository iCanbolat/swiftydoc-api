import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { DatabaseService } from '../../infrastructure/database/database.service';
import {
  auditEvents,
  fileAssets,
  organizations,
  requests,
  users,
  workspaceMemberships,
} from '../../infrastructure/database/schema';
import {
  ORGANIZATION_PLAN_ENTITLEMENTS,
  type OrganizationEntitlementKey,
  type OrganizationEntitlementLimits,
  type OrganizationEntitlementSnapshot,
  type OrganizationEntitlementUsage,
  type OrganizationPlanTier,
} from './organization-entitlements.types';

@Injectable()
export class OrganizationEntitlementsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSnapshot(
    organizationId: string,
  ): Promise<OrganizationEntitlementSnapshot> {
    const db = this.getDatabase();
    const [organization] = await db
      .select({
        id: organizations.id,
        planTier: organizations.planTier,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    const planTier = this.normalizePlanTier(organization.planTier);
    const [
      internalUsers,
      activeRequests,
      storageBytes,
      emailPerMonth,
      smsPerMonth,
    ] = await Promise.all([
      this.countInternalUsers(organizationId),
      this.countActiveRequests(organizationId),
      this.sumStorageBytes(organizationId),
      this.countEmailSentThisMonth(organizationId),
      this.countSmsSentThisMonth(organizationId),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      limits: { ...ORGANIZATION_PLAN_ENTITLEMENTS[planTier] },
      organizationId,
      planTier: organization.planTier,
      usage: {
        activeRequests,
        emailPerMonth,
        internalUsers,
        smsPerMonth,
        storageBytes,
      },
    };
  }

  async assertWithinLimit(
    organizationId: string,
    key: OrganizationEntitlementKey,
    increment = 1,
  ): Promise<OrganizationEntitlementSnapshot> {
    const snapshot = await this.getSnapshot(organizationId);
    const limit = snapshot.limits[key];

    if (limit === null) {
      return snapshot;
    }

    const projectedUsage = snapshot.usage[key] + increment;

    if (projectedUsage <= limit) {
      return snapshot;
    }

    throw new ForbiddenException(
      `Organization entitlement exceeded for ${key}. Current plan allows ${limit}.`,
    );
  }

  private async countInternalUsers(organizationId: string): Promise<number> {
    const db = this.getDatabase();
    const [row] = await db
      .select({
        count: sql<number>`count(distinct ${workspaceMemberships.userId})`,
      })
      .from(workspaceMemberships)
      .innerJoin(users, eq(users.id, workspaceMemberships.userId))
      .where(
        and(
          eq(workspaceMemberships.organizationId, organizationId),
          eq(workspaceMemberships.status, 'active'),
          eq(users.status, 'active'),
        ),
      );

    return Number(row?.count ?? 0);
  }

  private async countActiveRequests(organizationId: string): Promise<number> {
    const db = this.getDatabase();
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(requests)
      .where(
        and(
          eq(requests.organizationId, organizationId),
          inArray(requests.status, [
            'draft',
            'sent',
            'in_progress',
            'completed',
          ]),
        ),
      );

    return Number(row?.count ?? 0);
  }

  private async sumStorageBytes(organizationId: string): Promise<number> {
    const db = this.getDatabase();
    const [row] = await db
      .select({ value: sql<number>`coalesce(sum(${fileAssets.sizeBytes}), 0)` })
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.organizationId, organizationId),
          eq(fileAssets.status, 'active'),
        ),
      );

    return Number(row?.value ?? 0);
  }

  private async countSmsSentThisMonth(organizationId: string): Promise<number> {
    return this.countReminderSentThisMonth(organizationId, 'sms');
  }

  private async countEmailSentThisMonth(
    organizationId: string,
  ): Promise<number> {
    const db = this.getDatabase();
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, organizationId),
          inArray(auditEvents.action, [
            AUDIT_ACTIONS.data_access.requestReminderSent,
            AUDIT_ACTIONS.data_access.userEmailVerificationSent,
            AUDIT_ACTIONS.data_access.userInviteSent,
            AUDIT_ACTIONS.data_access.userPasswordResetRequested,
          ]),
          eq(auditEvents.channel, 'email'),
          gte(auditEvents.createdAt, monthStart),
          lt(auditEvents.createdAt, nextMonthStart),
        ),
      );

    return Number(row?.count ?? 0);
  }

  private async countReminderSentThisMonth(
    organizationId: string,
    channel: 'email' | 'sms',
  ): Promise<number> {
    const db = this.getDatabase();
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, organizationId),
          eq(auditEvents.action, AUDIT_ACTIONS.data_access.requestReminderSent),
          eq(auditEvents.channel, channel),
          gte(auditEvents.createdAt, monthStart),
          lt(auditEvents.createdAt, nextMonthStart),
        ),
      );

    return Number(row?.count ?? 0);
  }

  private normalizePlanTier(planTier: string): OrganizationPlanTier {
    if (planTier in ORGANIZATION_PLAN_ENTITLEMENTS) {
      return planTier as OrganizationPlanTier;
    }

    return 'enterprise';
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for organization entitlement operations.',
      );
    }

    return this.databaseService.db;
  }
}
