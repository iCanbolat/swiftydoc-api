import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../infrastructure/database/database.service';
import {
  clients,
  exportJobs,
  fileAssets,
  requests,
  submissionItems,
  submissions,
  templates,
} from '../../infrastructure/database/schema';
import type {
  AuthenticatedInternalActor,
  InternalAuthRequest,
} from './auth.types';
import {
  WORKSPACE_ACCESS_METADATA_KEY,
  type WorkspaceAccessOptions,
  type WorkspaceValueSource,
} from './workspace-access.decorator';

@Injectable()
export class WorkspaceMembershipGuard implements CanActivate {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<WorkspaceAccessOptions>(
      WORKSPACE_ACCESS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<InternalAuthRequest>();
    const actor = request.currentActor;

    if (!actor) {
      throw new UnauthorizedException('Bearer token is missing or invalid.');
    }

    const workspaceId = await this.resolveWorkspaceId(options, request, actor);
    request.resolvedWorkspaceId = workspaceId;

    if (
      this.hasOrganizationWideAccess(actor) ||
      actor.memberships.some(
        (membership) => membership.workspaceId === workspaceId,
      )
    ) {
      return true;
    }

    throw new ForbiddenException(
      'User does not have access to this workspace.',
    );
  }

  private hasOrganizationWideAccess(
    actor: AuthenticatedInternalActor,
  ): boolean {
    return (
      actor.roleNames.includes('organization_owner') ||
      actor.roleNames.includes('organization_admin')
    );
  }

  private async resolveWorkspaceId(
    options: WorkspaceAccessOptions,
    request: InternalAuthRequest,
    actor: AuthenticatedInternalActor,
  ): Promise<string> {
    switch (options.resource) {
      case 'workspace':
        return this.getRequiredValue(request, options.source, options.key);
      case 'client':
        return this.resolveClientWorkspaceId(
          this.getRequiredValue(request, options.source, options.key),
          actor.organization.id,
        );
      case 'template':
        return this.resolveTemplateWorkspaceId(
          this.getRequiredValue(request, options.source, options.key),
          actor.organization.id,
        );
      case 'request':
        return this.resolveRequestWorkspaceId(
          this.getRequiredValue(request, options.source, options.key),
          actor.organization.id,
        );
      case 'submission':
        return this.resolveSubmissionWorkspaceId(
          this.getRequiredValue(request, options.source, options.key),
          actor.organization.id,
        );
      case 'submissionItem':
        return this.resolveSubmissionItemWorkspaceId(
          this.getRequiredValue(request, options.source, options.key),
          actor.organization.id,
        );
      case 'fileId':
        return this.resolveFileWorkspaceIdByFileId(
          this.getRequiredValue(request, options.source, options.key),
          actor.organization.id,
        );
      case 'storageKey':
        return this.resolveFileWorkspaceIdByStorageKey(
          this.getRequiredValue(request, options.source, options.key),
          actor.organization.id,
        );
      case 'exportJob':
        return this.resolveExportJobWorkspaceId(
          this.getRequiredValue(request, options.source, options.key),
          actor.organization.id,
        );
      case 'fileContext':
        return this.resolveFileContextWorkspaceId(
          request,
          actor.organization.id,
          actor.session.activeWorkspaceId,
          options.fallbackToActiveWorkspace ?? false,
        );
      case 'exportContext':
        return this.resolveExportContextWorkspaceId(
          request,
          actor.organization.id,
          actor.session.activeWorkspaceId,
          options.fallbackToActiveWorkspace ?? false,
        );
      default:
        throw new BadRequestException(
          'Unsupported workspace access configuration.',
        );
    }
  }

  private async resolveRequestWorkspaceId(
    requestId: string,
    organizationId: string,
  ): Promise<string> {
    const [requestRow] = await this.getDatabase()
      .select({ workspaceId: requests.workspaceId })
      .from(requests)
      .where(
        and(
          eq(requests.id, requestId),
          eq(requests.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!requestRow) {
      throw new NotFoundException('Request not found.');
    }

    return requestRow.workspaceId;
  }

  private async resolveClientWorkspaceId(
    clientId: string,
    organizationId: string,
  ): Promise<string> {
    const [clientRow] = await this.getDatabase()
      .select({ workspaceId: clients.workspaceId })
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!clientRow) {
      throw new NotFoundException('Client not found.');
    }

    return clientRow.workspaceId;
  }

  private async resolveTemplateWorkspaceId(
    templateId: string,
    organizationId: string,
  ): Promise<string> {
    const [templateRow] = await this.getDatabase()
      .select({ workspaceId: templates.workspaceId })
      .from(templates)
      .where(
        and(
          eq(templates.id, templateId),
          eq(templates.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!templateRow) {
      throw new NotFoundException('Template not found.');
    }

    return templateRow.workspaceId;
  }

  private async resolveSubmissionWorkspaceId(
    submissionId: string,
    organizationId: string,
  ): Promise<string> {
    const [submissionRow] = await this.getDatabase()
      .select({ workspaceId: requests.workspaceId })
      .from(submissions)
      .innerJoin(requests, eq(requests.id, submissions.requestId))
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(submissions.organizationId, organizationId),
          eq(requests.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!submissionRow) {
      throw new NotFoundException('Submission not found.');
    }

    return submissionRow.workspaceId;
  }

  private async resolveSubmissionItemWorkspaceId(
    submissionItemId: string,
    organizationId: string,
  ): Promise<string> {
    const [submissionItemRow] = await this.getDatabase()
      .select({ workspaceId: requests.workspaceId })
      .from(submissionItems)
      .innerJoin(submissions, eq(submissions.id, submissionItems.submissionId))
      .innerJoin(requests, eq(requests.id, submissions.requestId))
      .where(
        and(
          eq(submissionItems.id, submissionItemId),
          eq(submissionItems.organizationId, organizationId),
          eq(submissions.organizationId, organizationId),
          eq(requests.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!submissionItemRow) {
      throw new NotFoundException('Submission item not found.');
    }

    return submissionItemRow.workspaceId;
  }

  private async resolveFileWorkspaceIdByFileId(
    fileId: string,
    organizationId: string,
  ): Promise<string> {
    const [fileRow] = await this.getDatabase()
      .select({
        metadata: fileAssets.metadata,
        requestId: fileAssets.requestId,
        submissionId: fileAssets.submissionId,
        submissionItemId: fileAssets.submissionItemId,
      })
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.id, fileId),
          eq(fileAssets.organizationId, organizationId),
          eq(fileAssets.status, 'active'),
        ),
      )
      .limit(1);

    if (!fileRow) {
      throw new NotFoundException('File metadata not found.');
    }

    return this.resolveWorkspaceIdFromResourceRefs(
      {
        metadata: fileRow.metadata,
        requestId: fileRow.requestId,
        submissionId: fileRow.submissionId,
        submissionItemId: fileRow.submissionItemId,
      },
      organizationId,
      'File',
    );
  }

  private async resolveFileWorkspaceIdByStorageKey(
    storageKey: string,
    organizationId: string,
  ): Promise<string> {
    const [fileRow] = await this.getDatabase()
      .select({
        metadata: fileAssets.metadata,
        requestId: fileAssets.requestId,
        submissionId: fileAssets.submissionId,
        submissionItemId: fileAssets.submissionItemId,
      })
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.storageKey, storageKey),
          eq(fileAssets.organizationId, organizationId),
          eq(fileAssets.status, 'active'),
        ),
      )
      .limit(1);

    if (!fileRow) {
      throw new NotFoundException('File metadata not found.');
    }

    return this.resolveWorkspaceIdFromResourceRefs(
      {
        metadata: fileRow.metadata,
        requestId: fileRow.requestId,
        submissionId: fileRow.submissionId,
        submissionItemId: fileRow.submissionItemId,
      },
      organizationId,
      'File',
    );
  }

  private async resolveExportJobWorkspaceId(
    exportJobId: string,
    organizationId: string,
  ): Promise<string> {
    const [exportJobRow] = await this.getDatabase()
      .select({
        metadata: exportJobs.metadata,
        requestId: exportJobs.requestId,
        submissionId: exportJobs.submissionId,
      })
      .from(exportJobs)
      .where(
        and(
          eq(exportJobs.id, exportJobId),
          eq(exportJobs.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!exportJobRow) {
      throw new NotFoundException('Export job not found.');
    }

    return this.resolveWorkspaceIdFromResourceRefs(
      {
        metadata: exportJobRow.metadata,
        requestId: exportJobRow.requestId,
        submissionId: exportJobRow.submissionId,
      },
      organizationId,
      'Export job',
    );
  }

  private async resolveFileContextWorkspaceId(
    request: InternalAuthRequest,
    organizationId: string,
    activeWorkspaceId: string,
    fallbackToActiveWorkspace: boolean,
  ): Promise<string> {
    const requestId = this.getOptionalValue(request, 'body', 'requestId');

    if (requestId) {
      return this.resolveRequestWorkspaceId(requestId, organizationId);
    }

    const submissionId = this.getOptionalValue(request, 'body', 'submissionId');

    if (submissionId) {
      return this.resolveSubmissionWorkspaceId(submissionId, organizationId);
    }

    const submissionItemId = this.getOptionalValue(
      request,
      'body',
      'submissionItemId',
    );

    if (submissionItemId) {
      return this.resolveSubmissionItemWorkspaceId(
        submissionItemId,
        organizationId,
      );
    }

    if (fallbackToActiveWorkspace) {
      return activeWorkspaceId;
    }

    throw new BadRequestException(
      'A workspace-scoped resource reference is required for file access.',
    );
  }

  private async resolveExportContextWorkspaceId(
    request: InternalAuthRequest,
    organizationId: string,
    activeWorkspaceId: string,
    fallbackToActiveWorkspace: boolean,
  ): Promise<string> {
    const requestId = this.getOptionalValue(request, 'body', 'requestId');

    if (requestId) {
      return this.resolveRequestWorkspaceId(requestId, organizationId);
    }

    const submissionId = this.getOptionalValue(request, 'body', 'submissionId');

    if (submissionId) {
      return this.resolveSubmissionWorkspaceId(submissionId, organizationId);
    }

    if (fallbackToActiveWorkspace) {
      return activeWorkspaceId;
    }

    throw new BadRequestException(
      'A workspace-scoped resource reference is required for export access.',
    );
  }

  private async resolveWorkspaceIdFromResourceRefs(
    input: {
      metadata: unknown;
      requestId?: string | null;
      submissionId?: string | null;
      submissionItemId?: string | null;
    },
    organizationId: string,
    resourceLabel: string,
  ): Promise<string> {
    if (input.submissionItemId) {
      return this.resolveSubmissionItemWorkspaceId(
        input.submissionItemId,
        organizationId,
      );
    }

    if (input.submissionId) {
      return this.resolveSubmissionWorkspaceId(
        input.submissionId,
        organizationId,
      );
    }

    if (input.requestId) {
      return this.resolveRequestWorkspaceId(input.requestId, organizationId);
    }

    const metadataWorkspaceId = this.readWorkspaceIdFromMetadata(
      input.metadata,
    );

    if (metadataWorkspaceId) {
      return metadataWorkspaceId;
    }

    throw new ForbiddenException(
      `${resourceLabel} is not bound to a workspace-scoped resource.`,
    );
  }

  private readWorkspaceIdFromMetadata(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const candidate = Reflect.get(metadata, 'workspaceId');
    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate
      : null;
  }

  private getRequiredValue(
    request: InternalAuthRequest,
    source: WorkspaceValueSource | undefined,
    key: string | undefined,
  ): string {
    const value = this.getOptionalValue(request, source, key);

    if (!value) {
      throw new BadRequestException(
        'Workspace access metadata is misconfigured.',
      );
    }

    return value;
  }

  private getOptionalValue(
    request: InternalAuthRequest,
    source: WorkspaceValueSource | undefined,
    key: string | undefined,
  ): string | null {
    if (!source || !key) {
      return null;
    }

    let rawValue: unknown;

    if (source === 'body') {
      rawValue = request.body?.[key];
    } else if (source === 'param') {
      rawValue = request.params?.[key];
    } else {
      rawValue = request.query?.[key];
    }

    if (Array.isArray(rawValue)) {
      rawValue = rawValue[0];
    }

    return typeof rawValue === 'string' && rawValue.trim().length > 0
      ? rawValue
      : null;
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for workspace authorization.',
      );
    }

    return this.databaseService.db;
  }
}
