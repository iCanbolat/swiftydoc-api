import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import {
  type PortalLinkPurpose,
  type PortalLinkStatus,
} from '../../common/portal/portal-link-types';
import {
  type RequestStatus,
  type RequestTransitionAction,
  type SubmissionStatus,
} from '../../common/requests/request-workflow';
import { WEBHOOK_EVENTS } from '../../common/webhooks/webhook-events';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import {
  answers,
  portalLinks,
  requests,
  submissionItems,
  submissions,
  templateFields,
} from '../../infrastructure/database/schema';
import { WebhookService } from '../../infrastructure/webhooks/webhook.service';

const TRANSITION_RULES: Record<
  RequestTransitionAction,
  readonly RequestStatus[]
> = {
  send: ['draft'],
  close: ['sent', 'in_progress', 'completed'],
  reopen: ['closed'],
};

const PORTAL_DEFAULT_EXPIRES_IN_MINUTES = 60 * 24 * 7;

type AnswerActorType = 'recipient' | 'reviewer' | 'system';

type AnswerSource = 'portal' | 'api';

export interface CreateRequestInput {
  organizationId: string;
  workspaceId: string;
  clientId: string;
  templateId: string;
  templateVersionId: string;
  title: string;
  message?: string;
  dueAt?: string;
  createdByUserId?: string;
  requestCode?: string;
  recipientIds: string[];
}

export interface TransitionRequestInput {
  organizationId: string;
  actorUserId?: string;
  reason?: string;
}

export interface CreatePortalLinkInput {
  organizationId: string;
  purpose?: PortalLinkPurpose;
  submissionId?: string;
  recipientId?: string;
  expiresInMinutes?: number;
  maxUses?: number;
  metadata?: Record<string, unknown>;
  createdByUserId?: string;
}

export interface VerifyPortalLinkInput {
  requestId: string;
  token: string;
  purpose?: PortalLinkPurpose;
  consume?: boolean;
}

export interface AutosaveAnswerInput {
  submissionItemId: string;
  value: Record<string, unknown>;
}

export interface AutosaveSubmissionInput {
  organizationId: string;
  answers: AutosaveAnswerInput[];
  answeredByType: AnswerActorType;
  answeredById?: string;
  source: AnswerSource;
}

@Injectable()
export class RequestWorkflowService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly databaseService: DatabaseService,
    private readonly webhookService: WebhookService,
  ) {}

  async createRequest(input: CreateRequestInput) {
    const db = this.getDatabase();
    const requestId = randomUUID();
    const now = new Date();
    const requestCode = input.requestCode ?? this.generateRequestCode();

    await db.insert(requests).values({
      id: requestId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      templateId: input.templateId,
      templateVersionId: input.templateVersionId,
      requestCode,
      title: input.title,
      message: input.message,
      status: 'draft',
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });

    const templateFieldIds =
      input.recipientIds.length > 0
        ? await db
            .select({ id: templateFields.id })
            .from(templateFields)
            .where(
              eq(templateFields.templateVersionId, input.templateVersionId),
            )
        : [];

    let createdSubmissionCount = 0;

    for (const recipientId of input.recipientIds) {
      const submissionId = randomUUID();
      createdSubmissionCount += 1;

      await db.insert(submissions).values({
        id: submissionId,
        organizationId: input.organizationId,
        requestId,
        recipientId,
        status: 'in_progress',
        progressPercent: 0,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      });

      if (templateFieldIds.length > 0) {
        await db.insert(submissionItems).values(
          templateFieldIds.map((field) => ({
            id: randomUUID(),
            organizationId: input.organizationId,
            submissionId,
            templateFieldId: field.id,
            status: 'pending' as const,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
    }

    await this.auditLogService.record({
      category: 'data_access',
      action: AUDIT_ACTIONS.data_access.requestCreated,
      organizationId: input.organizationId,
      actorId: input.createdByUserId,
      actorType: input.createdByUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.documents.request,
      resourceId: requestId,
      metadata: {
        requestCode,
        recipientCount: input.recipientIds.length,
      },
    });

    await this.webhookService.emitEvent(
      WEBHOOK_EVENTS.requests.created,
      {
        requestId,
        requestCode,
        status: 'draft',
        workspaceId: input.workspaceId,
        clientId: input.clientId,
      },
      input.organizationId,
    );

    return {
      id: requestId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      templateId: input.templateId,
      templateVersionId: input.templateVersionId,
      requestCode,
      title: input.title,
      status: 'draft' as RequestStatus,
      dueAt: input.dueAt ?? null,
      sentAt: null,
      closedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdSubmissionCount,
    };
  }

  async transitionRequestStatus(
    requestId: string,
    action: RequestTransitionAction,
    input: TransitionRequestInput,
  ) {
    const db = this.getDatabase();
    const [requestRow] = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.id, requestId),
          eq(requests.organizationId, input.organizationId),
        ),
      )
      .limit(1);

    if (!requestRow) {
      throw new NotFoundException('Request not found.');
    }

    this.assertTransitionAllowed(requestRow.status, action);

    const now = new Date();
    const nextStatus = this.resolveNextStatus(action);

    await db
      .update(requests)
      .set({
        status: nextStatus,
        sentAt: action === 'send' ? now : requestRow.sentAt,
        closedAt:
          action === 'close'
            ? now
            : action === 'reopen'
              ? null
              : requestRow.closedAt,
        updatedAt: now,
      })
      .where(eq(requests.id, requestId));

    if (action === 'reopen') {
      await db
        .update(submissions)
        .set({
          status: 'reopened',
          submittedAt: null,
          updatedAt: now,
          lastActivityAt: now,
        })
        .where(eq(submissions.requestId, requestId));

      await this.webhookService.emitEvent(
        WEBHOOK_EVENTS.submissions.updated,
        {
          requestId,
          status: 'reopened',
          source: 'request.reopen',
        },
        input.organizationId,
      );
    }

    if (action === 'send') {
      await this.webhookService.emitEvent(
        WEBHOOK_EVENTS.requests.sent,
        {
          requestId,
          requestCode: requestRow.requestCode,
          status: nextStatus,
          workspaceId: requestRow.workspaceId,
        },
        input.organizationId,
      );
    }

    await this.auditLogService.record({
      category: 'data_access',
      action:
        action === 'send'
          ? AUDIT_ACTIONS.data_access.requestSent
          : action === 'close'
            ? AUDIT_ACTIONS.data_access.requestClosed
            : AUDIT_ACTIONS.data_access.requestReopened,
      organizationId: input.organizationId,
      actorId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.documents.request,
      resourceId: requestId,
      metadata: {
        fromStatus: requestRow.status,
        toStatus: nextStatus,
        reason: input.reason,
      },
    });

    return {
      id: requestId,
      status: nextStatus,
      sentAt:
        action === 'send'
          ? now.toISOString()
          : (requestRow.sentAt?.toISOString() ?? null),
      closedAt:
        action === 'close'
          ? now.toISOString()
          : action === 'reopen'
            ? null
            : (requestRow.closedAt?.toISOString() ?? null),
      updatedAt: now.toISOString(),
    };
  }

  async createPortalLink(
    requestId: string,
    input: CreatePortalLinkInput,
    baseUrl: string,
  ) {
    const db = this.getDatabase();

    const [requestRow] = await db
      .select({
        id: requests.id,
      })
      .from(requests)
      .where(
        and(
          eq(requests.id, requestId),
          eq(requests.organizationId, input.organizationId),
        ),
      )
      .limit(1);

    if (!requestRow) {
      throw new NotFoundException('Request not found.');
    }

    const now = new Date();
    const portalLinkId = randomUUID();
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const purpose = input.purpose ?? 'request_access';
    const expiresAt = new Date(
      now.getTime() +
        (input.expiresInMinutes ?? PORTAL_DEFAULT_EXPIRES_IN_MINUTES) * 60000,
    );
    const maxUses = input.maxUses ?? 1;

    await db.insert(portalLinks).values({
      id: portalLinkId,
      organizationId: input.organizationId,
      requestId,
      submissionId: input.submissionId,
      recipientId: input.recipientId,
      purpose,
      tokenHash,
      status: 'active',
      expiresAt,
      maxUses,
      usedCount: 0,
      createdByUserId: input.createdByUserId,
      metadata: input.metadata ?? {},
      createdAt: now,
    });

    await this.auditLogService.record({
      category: 'data_access',
      action: AUDIT_ACTIONS.data_access.portalLinkCreated,
      organizationId: input.organizationId,
      actorId: input.createdByUserId,
      actorType: input.createdByUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.documents.portalLink,
      resourceId: portalLinkId,
      metadata: {
        requestId,
        purpose,
        maxUses,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      id: portalLinkId,
      requestId,
      submissionId: input.submissionId ?? null,
      recipientId: input.recipientId ?? null,
      purpose,
      status: 'active' as PortalLinkStatus,
      expiresAt: expiresAt.toISOString(),
      maxUses,
      usedCount: 0,
      token,
      accessUrl: `${baseUrl}/v1/portal/access?requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(token)}`,
    };
  }

  async verifyPortalLink(input: VerifyPortalLinkInput) {
    const db = this.getDatabase();
    const now = new Date();
    const tokenHash = this.hashToken(input.token);

    const whereClauses = [
      eq(portalLinks.requestId, input.requestId),
      eq(portalLinks.tokenHash, tokenHash),
    ];

    if (input.purpose) {
      whereClauses.push(eq(portalLinks.purpose, input.purpose));
    }

    const [portalLink] = await db
      .select()
      .from(portalLinks)
      .where(and(...whereClauses))
      .limit(1);

    if (!portalLink) {
      throw new UnauthorizedException('Portal link is invalid.');
    }

    if (portalLink.status !== 'active') {
      throw new UnauthorizedException('Portal link is no longer active.');
    }

    if (portalLink.expiresAt.getTime() <= now.getTime()) {
      await db
        .update(portalLinks)
        .set({
          status: 'expired',
        })
        .where(eq(portalLinks.id, portalLink.id));

      throw new UnauthorizedException('Portal link has expired.');
    }

    if (portalLink.usedCount >= portalLink.maxUses) {
      await db
        .update(portalLinks)
        .set({
          status: 'consumed',
        })
        .where(eq(portalLinks.id, portalLink.id));

      throw new UnauthorizedException('Portal link has already been consumed.');
    }

    const consume = input.consume ?? true;
    let usedCount = portalLink.usedCount;
    let status: PortalLinkStatus = portalLink.status;

    if (consume) {
      usedCount += 1;
      status = usedCount >= portalLink.maxUses ? 'consumed' : 'active';

      await db
        .update(portalLinks)
        .set({
          usedCount,
          status,
          lastUsedAt: now,
        })
        .where(eq(portalLinks.id, portalLink.id));
    }

    await this.auditLogService.record({
      category: 'data_access',
      action: AUDIT_ACTIONS.data_access.portalLinkVerified,
      organizationId: portalLink.organizationId,
      resourceType: RESOURCE_TYPES.documents.portalLink,
      resourceId: portalLink.id,
      metadata: {
        requestId: portalLink.requestId,
        purpose: portalLink.purpose,
        consume,
      },
    });

    return {
      portalLinkId: portalLink.id,
      organizationId: portalLink.organizationId,
      requestId: portalLink.requestId,
      submissionId: portalLink.submissionId,
      recipientId: portalLink.recipientId,
      purpose: portalLink.purpose,
      status,
      consumed: consume && status === 'consumed',
      remainingUses: Math.max(0, portalLink.maxUses - usedCount),
      expiresAt: portalLink.expiresAt.toISOString(),
    };
  }

  async autosaveSubmissionAnswers(
    submissionId: string,
    input: AutosaveSubmissionInput,
  ) {
    const db = this.getDatabase();
    const now = new Date();

    const [submission] = await db
      .select({
        id: submissions.id,
        organizationId: submissions.organizationId,
        requestId: submissions.requestId,
        status: submissions.status,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(submissions.organizationId, input.organizationId),
        ),
      )
      .limit(1);

    if (!submission) {
      throw new NotFoundException('Submission not found.');
    }

    const distinctItemIds = [
      ...new Set(input.answers.map((item) => item.submissionItemId)),
    ];

    const existingItems = await db
      .select({ id: submissionItems.id })
      .from(submissionItems)
      .where(
        and(
          eq(submissionItems.submissionId, submissionId),
          inArray(submissionItems.id, distinctItemIds),
        ),
      );

    if (existingItems.length !== distinctItemIds.length) {
      throw new BadRequestException(
        'One or more submission items are invalid.',
      );
    }

    await db
      .insert(answers)
      .values(
        input.answers.map((entry) => ({
          id: randomUUID(),
          organizationId: input.organizationId,
          submissionItemId: entry.submissionItemId,
          value: entry.value,
          answeredByType: input.answeredByType,
          answeredById: input.answeredById,
          source: input.source,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: answers.submissionItemId,
        set: {
          value: sql`excluded.value`,
          answeredByType: sql`excluded.answered_by_type`,
          answeredById: sql`excluded.answered_by_id`,
          source: sql`excluded.source`,
          updatedAt: now,
        },
      });

    await db
      .update(submissionItems)
      .set({
        status: 'provided',
        updatedAt: now,
      })
      .where(
        and(
          eq(submissionItems.submissionId, submissionId),
          inArray(submissionItems.id, distinctItemIds),
        ),
      );

    const [totalItemsRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(submissionItems)
      .where(eq(submissionItems.submissionId, submissionId));

    const [completedItemsRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(submissionItems)
      .where(
        and(
          eq(submissionItems.submissionId, submissionId),
          inArray(submissionItems.status, ['provided', 'approved']),
        ),
      );

    const totalItems = Number(totalItemsRow?.count ?? 0);
    const completedItems = Number(completedItemsRow?.count ?? 0);

    const progressPercent =
      totalItems === 0
        ? 0
        : Math.max(
            0,
            Math.min(100, Math.round((completedItems * 100) / totalItems)),
          );

    const nextSubmissionStatus: SubmissionStatus =
      progressPercent === 100
        ? 'completed'
        : submission.status === 'completed'
          ? 'reopened'
          : submission.status === 'reopened'
            ? 'reopened'
            : 'in_progress';

    await db
      .update(submissions)
      .set({
        status: nextSubmissionStatus,
        progressPercent,
        submittedAt: progressPercent === 100 ? now : null,
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(submissions.id, submissionId));

    await this.auditLogService.record({
      category: 'data_access',
      action: AUDIT_ACTIONS.data_access.submissionAutosaved,
      organizationId: input.organizationId,
      actorType: input.answeredByType,
      actorId: input.answeredById,
      resourceType: RESOURCE_TYPES.documents.submission,
      resourceId: submissionId,
      metadata: {
        answeredItems: distinctItemIds.length,
        progressPercent,
        submissionStatus: nextSubmissionStatus,
      },
    });

    await this.webhookService.emitEvent(
      WEBHOOK_EVENTS.submissions.updated,
      {
        submissionId,
        requestId: submission.requestId,
        progressPercent,
        status: nextSubmissionStatus,
      },
      input.organizationId,
    );

    return {
      submissionId,
      status: nextSubmissionStatus,
      progressPercent,
      answeredItems: distinctItemIds.length,
      totalItems,
      completedItems,
      updatedAt: now.toISOString(),
    };
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for request workflow operations.',
      );
    }

    return this.databaseService.db;
  }

  private generateRequestCode(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const suffix = randomUUID().slice(0, 8).toUpperCase();

    return `REQ-${stamp}-${suffix}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertTransitionAllowed(
    currentStatus: RequestStatus,
    action: RequestTransitionAction,
  ): void {
    const allowedFromStatuses = TRANSITION_RULES[action];

    if (!allowedFromStatuses.includes(currentStatus)) {
      throw new ConflictException(
        `Cannot ${action} a request from status ${currentStatus}.`,
      );
    }
  }

  private resolveNextStatus(action: RequestTransitionAction): RequestStatus {
    switch (action) {
      case 'send':
        return 'sent';
      case 'close':
        return 'closed';
      case 'reopen':
        return 'in_progress';
      default:
        throw new BadRequestException('Unsupported transition action.');
    }
  }
}
