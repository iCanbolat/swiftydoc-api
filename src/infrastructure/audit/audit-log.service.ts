import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AuditAction, AuditCategory } from '../../common/audit/audit-actions';
import type { AuditChannel } from '../../common/audit/audit-channel';
import type { ResourceType } from '../../common/audit/resource-types';
import { DatabaseService } from '../database/database.service';
import { auditEvents, users, workspaces } from '../database/schema';
import type { AuditAuthSurface, AuditLogEntry } from './audit.types';
import { RequestAuditContextService } from './request-audit-context.service';

interface ListAuditEventsFilters {
  action?: AuditAction;
  actorId?: string;
  authSurface?: AuditAuthSurface;
  beforeCreatedAt?: string;
  category?: AuditCategory;
  channel?: AuditChannel;
  impersonatorActorId?: string;
  impersonatorSessionId?: string;
  limit?: number;
  resourceId?: string;
  resourceType?: ResourceType;
  sessionId?: string;
  workspaceId?: string;
}

interface AuditUserSummary {
  email: string;
  fullName: string;
  id: string;
}

interface AuditWorkspaceSummary {
  code: string;
  id: string;
  name: string;
}

interface AuditEventReferenceMaps {
  usersById: Map<string, AuditUserSummary>;
  workspacesById: Map<string, AuditWorkspaceSummary>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly requestAuditContextService: RequestAuditContextService,
  ) {}

  async listEvents(
    organizationId: string,
    filters: ListAuditEventsFilters = {},
  ) {
    let whereClause = eq(auditEvents.organizationId, organizationId);

    if (filters.workspaceId) {
      whereClause =
        and(whereClause, eq(auditEvents.activeWorkspaceId, filters.workspaceId)) ??
        whereClause;
    }

    if (filters.sessionId) {
      whereClause =
        and(whereClause, eq(auditEvents.sessionId, filters.sessionId)) ??
        whereClause;
    }

    if (filters.authSurface) {
      whereClause =
        and(whereClause, eq(auditEvents.authSurface, filters.authSurface)) ??
        whereClause;
    }

    if (filters.category) {
      whereClause =
        and(whereClause, eq(auditEvents.category, filters.category)) ??
        whereClause;
    }

    if (filters.action) {
      whereClause =
        and(whereClause, eq(auditEvents.action, filters.action)) ??
        whereClause;
    }

    if (filters.channel) {
      whereClause =
        and(whereClause, eq(auditEvents.channel, filters.channel)) ??
        whereClause;
    }

    if (filters.actorId) {
      whereClause =
        and(whereClause, eq(auditEvents.actorId, filters.actorId)) ??
        whereClause;
    }

    if (filters.impersonatorActorId) {
      whereClause =
        and(
          whereClause,
          eq(auditEvents.impersonatorActorId, filters.impersonatorActorId),
        ) ?? whereClause;
    }

    if (filters.impersonatorSessionId) {
      whereClause =
        and(
          whereClause,
          eq(auditEvents.impersonatorSessionId, filters.impersonatorSessionId),
        ) ?? whereClause;
    }

    if (filters.resourceType) {
      whereClause =
        and(whereClause, eq(auditEvents.resourceType, filters.resourceType)) ??
        whereClause;
    }

    if (filters.resourceId) {
      whereClause =
        and(whereClause, eq(auditEvents.resourceId, filters.resourceId)) ??
        whereClause;
    }

    if (filters.beforeCreatedAt) {
      whereClause =
        and(
          whereClause,
          lt(auditEvents.createdAt, new Date(filters.beforeCreatedAt)),
        ) ?? whereClause;
    }

    const events = await this.databaseService.db
      .select()
      .from(auditEvents)
      .where(whereClause)
      .orderBy(desc(auditEvents.createdAt))
      .limit(filters.limit ?? 50);

    const references = await this.loadEventReferences(organizationId, events);

    return events.map((event) => this.serializeEvent(event, references));
  }

  async record(entry: AuditLogEntry): Promise<void> {
    const eventId = randomUUID();
    const requestContext = this.requestAuditContextService.getContext();
    const activeWorkspaceId =
      entry.activeWorkspaceId ?? requestContext?.activeWorkspaceId ?? null;
    const authSurface =
      entry.authSurface ?? requestContext?.authSurface ?? 'system';
    const impersonatorActorId =
      entry.impersonatorActorId ?? requestContext?.impersonatorActorId ?? null;
    const impersonatorSessionId =
      entry.impersonatorSessionId ??
      requestContext?.impersonatorSessionId ??
      null;
    const sessionId = entry.sessionId ?? requestContext?.sessionId ?? null;

    this.logger.log(
      JSON.stringify({
        auditId: eventId,
        activeWorkspaceId,
        category: entry.category,
        action: entry.action,
        authSurface,
        channel: entry.channel ?? null,
        organizationId: entry.organizationId ?? null,
        sessionId,
      }),
    );

    if (!this.databaseService.isConfigured()) {
      return;
    }

    try {
      await this.databaseService.db.insert(auditEvents).values({
        id: eventId,
        organizationId: entry.organizationId,
        category: entry.category,
        channel: entry.channel,
        action: entry.action,
        authSurface,
        actorType: entry.actorType,
        actorId: entry.actorId,
        sessionId,
        activeWorkspaceId,
        impersonatorActorId,
        impersonatorSessionId,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata ?? {},
      });
    } catch (error) {
      this.logger.error(
        'Failed to persist audit event.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async loadEventReferences(
    organizationId: string,
    events: Array<typeof auditEvents.$inferSelect>,
  ): Promise<AuditEventReferenceMaps> {
    const userIds = Array.from(
      new Set(
        events
          .flatMap((event) => [event.actorId, event.impersonatorActorId])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const workspaceIds = Array.from(
      new Set(
        events
          .map((event) => event.activeWorkspaceId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const [actorRows, workspaceRows] = await Promise.all([
      userIds.length === 0
        ? Promise.resolve([])
        : this.databaseService.db
            .select({
              email: users.email,
              fullName: users.fullName,
              id: users.id,
            })
            .from(users)
            .where(inArray(users.id, userIds)),
      workspaceIds.length === 0
        ? Promise.resolve([])
        : this.databaseService.db
            .select({
              code: workspaces.code,
              id: workspaces.id,
              name: workspaces.name,
            })
            .from(workspaces)
            .where(
              and(
                eq(workspaces.organizationId, organizationId),
                inArray(workspaces.id, workspaceIds),
              ),
            ),
    ]);

    return {
      usersById: new Map<string, AuditUserSummary>(
        actorRows.map((row) => [row.id, row] as const),
      ),
      workspacesById: new Map<string, AuditWorkspaceSummary>(
        workspaceRows.map((row) => [row.id, row] as const),
      ),
    };
  }

  serializeEvent(
    event: typeof auditEvents.$inferSelect,
    references?: AuditEventReferenceMaps,
  ) {
    const actor = event.actorId
      ? references?.usersById.get(event.actorId) ?? null
      : null;
    const activeWorkspace = event.activeWorkspaceId
      ? references?.workspacesById.get(event.activeWorkspaceId) ?? null
      : null;
    const impersonator = event.impersonatorActorId
      ? references?.usersById.get(event.impersonatorActorId) ?? null
      : null;

    return {
      id: event.id,
      organizationId: event.organizationId,
      category: event.category,
      channel: event.channel,
      action: event.action,
      authSurface: event.authSurface,
      actorType: event.actorType,
      actorId: event.actorId,
      actor,
      sessionId: event.sessionId,
      activeWorkspaceId: event.activeWorkspaceId,
      activeWorkspace,
      impersonatorActorId: event.impersonatorActorId,
      impersonatorSessionId: event.impersonatorSessionId,
      impersonator,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    };
  }
}
