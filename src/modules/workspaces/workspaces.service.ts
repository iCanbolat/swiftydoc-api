import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { workspaces } from '../../infrastructure/database/schema';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceView,
} from './workspaces.types';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly databaseService: DatabaseService,
  ) {}

  async listWorkspaces(organizationId: string): Promise<WorkspaceView[]> {
    const db = this.getDatabase();
    const items = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.organizationId, organizationId))
      .orderBy(asc(workspaces.name));

    return items.map((item) => this.serializeWorkspace(item));
  }

  async getWorkspace(
    workspaceId: string,
    organizationId: string,
  ): Promise<WorkspaceView> {
    const db = this.getDatabase();
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    return this.serializeWorkspace(workspace);
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceView> {
    const db = this.getDatabase();
    const now = new Date();

    try {
      const [workspace] = await db
        .insert(workspaces)
        .values({
          id: randomUUID(),
          organizationId: input.organizationId,
          name: input.name.trim(),
          code: this.normalizeCode(input.code),
          defaultBrandingId: null,
          defaultReminderPolicyId: null,
          status: input.status ?? 'active',
          createdAt: now,
        })
        .returning();

      await this.auditLogService.record({
        category: 'data_access',
        channel: 'api',
        action: AUDIT_ACTIONS.data_access.workspaceCreated,
        organizationId: input.organizationId,
        actorId: input.actorUserId,
        actorType: input.actorUserId ? 'user' : undefined,
        resourceType: RESOURCE_TYPES.identity.workspace,
        resourceId: workspace.id,
        metadata: {
          code: workspace.code,
          status: workspace.status,
        },
      });

      return this.serializeWorkspace(workspace);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException(
          'Workspace code is already in use for this organization.',
        );
      }

      throw error;
    }
  }

  async updateWorkspace(
    workspaceId: string,
    input: UpdateWorkspaceInput,
  ): Promise<WorkspaceView> {
    const current = await this.getWorkspace(workspaceId, input.organizationId);
    const db = this.getDatabase();

    try {
      const [workspace] = await db
        .update(workspaces)
        .set({
          name: input.name?.trim() ?? current.name,
          code:
            input.code !== undefined
              ? this.normalizeCode(input.code)
              : current.code,
          status: input.status ?? current.status,
        })
        .where(eq(workspaces.id, workspaceId))
        .returning();

      await this.auditLogService.record({
        category: 'data_access',
        channel: 'api',
        action: AUDIT_ACTIONS.data_access.workspaceUpdated,
        organizationId: input.organizationId,
        actorId: input.actorUserId,
        actorType: input.actorUserId ? 'user' : undefined,
        resourceType: RESOURCE_TYPES.identity.workspace,
        resourceId: workspace.id,
        metadata: {
          code: workspace.code,
          status: workspace.status,
        },
      });

      return this.serializeWorkspace(workspace);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException(
          'Workspace code is already in use for this organization.',
        );
      }

      throw error;
    }
  }

  private serializeWorkspace(
    workspace: typeof workspaces.$inferSelect,
  ): WorkspaceView {
    return {
      id: workspace.id,
      organizationId: workspace.organizationId,
      name: workspace.name,
      code: workspace.code,
      status: workspace.status,
      createdAt: workspace.createdAt.toISOString(),
    };
  }

  private normalizeCode(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!normalized) {
      throw new BadRequestException('Workspace code is invalid.');
    }

    return normalized;
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for workspace management operations.',
      );
    }

    return this.databaseService.db;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === '23505'
    );
  }
}
