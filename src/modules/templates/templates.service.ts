import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { templates } from '../../infrastructure/database/schema';
import type {
  CreateTemplateInput,
  TemplateRecord,
  UpdateTemplateInput,
} from './templates.types';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly databaseService: DatabaseService,
  ) {}

  async listTemplates(
    organizationId: string,
    workspaceId: string,
  ): Promise<TemplateRecord[]> {
    const db = this.getDatabase();

    return db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.organizationId, organizationId),
          eq(templates.workspaceId, workspaceId),
        ),
      )
      .orderBy(desc(templates.createdAt));
  }

  async getTemplate(
    templateId: string,
    organizationId: string,
  ): Promise<TemplateRecord> {
    const db = this.getDatabase();
    const [template] = await db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.id, templateId),
          eq(templates.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!template) {
      throw new NotFoundException('Template not found.');
    }

    return template;
  }

  async createTemplate(input: CreateTemplateInput): Promise<TemplateRecord> {
    const db = this.getDatabase();
    const now = new Date();

    try {
      const [template] = await db
        .insert(templates)
        .values({
          id: randomUUID(),
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          name: input.name.trim(),
          slug: input.slug.trim().toLowerCase(),
          description: this.normalizeOptionalString(input.description) ?? null,
          status: input.status ?? 'draft',
          publishedVersionNumber: null,
          createdByUserId: input.actorUserId,
          createdAt: now,
          updatedAt: now,
          archivedAt: input.status === 'archived' ? now : null,
        })
        .returning();

      await this.auditLogService.record({
        category: 'data_access',
        channel: 'api',
        action: AUDIT_ACTIONS.data_access.templateCreated,
        organizationId: template.organizationId,
        actorId: input.actorUserId,
        actorType: 'user',
        resourceType: RESOURCE_TYPES.documents.template,
        resourceId: template.id,
        metadata: {
          workspaceId: template.workspaceId,
          status: template.status,
        },
      });

      return template;
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new BadRequestException(
          'Invalid workspace reference for template creation.',
        );
      }

      if (this.isUniqueViolation(error, 'templates_workspace_slug_key')) {
        throw new BadRequestException(
          'Template slug must be unique within a workspace.',
        );
      }

      throw error;
    }
  }

  async updateTemplate(
    templateId: string,
    input: UpdateTemplateInput,
  ): Promise<TemplateRecord> {
    const currentTemplate = await this.getTemplate(
      templateId,
      input.organizationId,
    );
    const db = this.getDatabase();
    const now = new Date();

    try {
      const [template] = await db
        .update(templates)
        .set({
          name: input.name?.trim() ?? currentTemplate.name,
          slug:
            input.slug !== undefined
              ? input.slug.trim().toLowerCase()
              : currentTemplate.slug,
          description:
            input.description !== undefined
              ? (this.normalizeOptionalString(input.description) ?? null)
              : currentTemplate.description,
          status: input.status ?? currentTemplate.status,
          updatedAt: now,
          archivedAt:
            input.status === 'archived'
              ? (currentTemplate.archivedAt ?? now)
              : input.status === 'draft' || input.status === 'published'
                ? null
                : currentTemplate.archivedAt,
        })
        .where(eq(templates.id, currentTemplate.id))
        .returning();

      await this.auditLogService.record({
        category: 'data_access',
        channel: 'api',
        action: AUDIT_ACTIONS.data_access.templateUpdated,
        organizationId: template.organizationId,
        actorId: input.actorUserId,
        actorType: 'user',
        resourceType: RESOURCE_TYPES.documents.template,
        resourceId: template.id,
        metadata: {
          workspaceId: template.workspaceId,
          status: template.status,
        },
      });

      return template;
    } catch (error) {
      if (this.isUniqueViolation(error, 'templates_workspace_slug_key')) {
        throw new BadRequestException(
          'Template slug must be unique within a workspace.',
        );
      }

      throw error;
    }
  }

  serializeTemplate(template: TemplateRecord) {
    return {
      ...template,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      archivedAt: template.archivedAt?.toISOString() ?? null,
    };
  }

  private normalizeOptionalString(
    value: string | undefined,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for template operations.',
      );
    }

    return this.databaseService.db;
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === '23503'
    );
  }

  private isUniqueViolation(error: unknown, constraint: string): boolean {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === '23505' &&
      'constraint' in error &&
      error.constraint === constraint
    );
  }
}
