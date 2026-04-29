import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import type { AuditChannel } from '../../common/audit/audit-channel';
import {
  type PaginatedResult,
  paginateResult,
} from '../../common/http/pagination.dto';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { type PortalLinkStatus } from '../../common/portal/portal-link-types';
import { type ReminderChannel } from '../../common/reminders/reminder-types';
import {
  type RequestStatus,
  type RequestTransitionAction,
  type SubmissionItemStatus,
  type SubmissionStatus,
} from '../../common/requests/request-workflow';
import { WEBHOOK_EVENTS } from '../../common/webhooks/webhook-events';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RemindersService } from '../../infrastructure/reminders/reminders.service';
import { OrganizationEntitlementsService } from '../auth/organization-entitlements.service';
import {
  answers,
  comments,
  portalLinks,
  requests,
  reviewDecisions,
  submissionItems,
  submissions,
  templateFields,
  templates,
  users,
} from '../../infrastructure/database/schema';
import { WebhookService } from '../../infrastructure/webhooks/webhook.service';
import {
  PORTAL_DEFAULT_EXPIRES_IN_MINUTES,
  TRANSITION_RULES,
} from './request-workflow.constants';
import type {
  AnswerActorType,
  AnswerSource,
  AutosaveAnswerInput,
  AutosaveSubmissionInput,
  CommentAuthorType,
  CreatePortalLinkInput,
  CreateRequestInput,
  CreateSubmissionItemCommentInput,
  ListRequestsInput,
  RequestReadModel,
  ReviewDecisionType,
  ReviewSubmissionItemInput,
  SendRequestReminderInput,
  TransitionRequestInput,
  VerifyPortalLinkInput,
} from './request-workflow.types';

type RequestReadModelRow = {
  id: string;
  organizationId: string;
  workspaceId: string;
  clientId: string;
  templateId: string;
  templateVersionId: string;
  requestCode: string;
  title: string;
  message: string | null;
  status: RequestStatus;
  dueAt: Date | null;
  sentAt: Date | null;
  closedAt: Date | null;
  templateName: string;
  recipientCount: number | string | null;
  completedItems: number | string | null;
  totalItems: number | string | null;
  ownerUserId: string | null;
  ownerUserFullName: string | null;
  ownerUserEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class RequestWorkflowService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly databaseService: DatabaseService,
    private readonly organizationEntitlementsService: OrganizationEntitlementsService,
    private readonly remindersService: RemindersService,
    private readonly webhookService: WebhookService,
  ) {}

  async listRequests(
    input: ListRequestsInput,
  ): Promise<PaginatedResult<RequestReadModel>> {
    const db = this.getDatabase();
    const conditions = [
      eq(requests.organizationId, input.organizationId),
      eq(requests.workspaceId, input.workspaceId),
    ];

    const clientId = this.normalizeOptionalString(input.clientId);

    if (clientId) {
      conditions.push(eq(requests.clientId, clientId));
    }

    if (input.status) {
      conditions.push(eq(requests.status, input.status));
    }

    const requestSubmissionAggregates = db
      .select({
        requestId: submissions.requestId,
        recipientCount: sql<number>`count(distinct ${submissions.id})`,
        completedItems: sql<number>`count(case when ${submissionItems.status} in ('provided', 'approved') then 1 end)`,
        totalItems: sql<number>`count(${submissionItems.id})`,
      })
      .from(submissions)
      .leftJoin(
        submissionItems,
        eq(submissionItems.submissionId, submissions.id),
      )
      .groupBy(submissions.requestId)
      .as('request_submission_aggregates');

    const [countRows, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(requests)
        .where(and(...conditions)),
      db
        .select({
          id: requests.id,
          organizationId: requests.organizationId,
          workspaceId: requests.workspaceId,
          clientId: requests.clientId,
          templateId: requests.templateId,
          templateVersionId: requests.templateVersionId,
          requestCode: requests.requestCode,
          title: requests.title,
          message: requests.message,
          status: requests.status,
          dueAt: requests.dueAt,
          sentAt: requests.sentAt,
          closedAt: requests.closedAt,
          templateName: templates.name,
          recipientCount: sql<number>`coalesce(${requestSubmissionAggregates.recipientCount}, 0)`,
          completedItems: sql<number>`coalesce(${requestSubmissionAggregates.completedItems}, 0)`,
          totalItems: sql<number>`coalesce(${requestSubmissionAggregates.totalItems}, 0)`,
          ownerUserId: users.id,
          ownerUserFullName: users.fullName,
          ownerUserEmail: users.email,
          createdAt: requests.createdAt,
          updatedAt: requests.updatedAt,
        })
        .from(requests)
        .innerJoin(templates, eq(templates.id, requests.templateId))
        .leftJoin(users, eq(users.id, requests.createdByUserId))
        .leftJoin(
          requestSubmissionAggregates,
          eq(requestSubmissionAggregates.requestId, requests.id),
        )
        .where(and(...conditions))
        .orderBy(desc(requests.updatedAt), desc(requests.id))
        .limit(input.pagination.pageSize)
        .offset(input.pagination.offset),
    ]);

    return paginateResult(
      rows.map((row) => this.serializeRequestReadModel(row)),
      countRows[0]?.count ?? 0,
      input.pagination,
    );
  }

  async getRequest(
    requestId: string,
    organizationId: string,
  ): Promise<RequestReadModel> {
    const db = this.getDatabase();

    const requestSubmissionAggregates = db
      .select({
        requestId: submissions.requestId,
        recipientCount: sql<number>`count(distinct ${submissions.id})`,
        completedItems: sql<number>`count(case when ${submissionItems.status} in ('provided', 'approved') then 1 end)`,
        totalItems: sql<number>`count(${submissionItems.id})`,
      })
      .from(submissions)
      .leftJoin(
        submissionItems,
        eq(submissionItems.submissionId, submissions.id),
      )
      .groupBy(submissions.requestId)
      .as('request_submission_aggregates');

    const [requestRow] = await db
      .select({
        id: requests.id,
        organizationId: requests.organizationId,
        workspaceId: requests.workspaceId,
        clientId: requests.clientId,
        templateId: requests.templateId,
        templateVersionId: requests.templateVersionId,
        requestCode: requests.requestCode,
        title: requests.title,
        message: requests.message,
        status: requests.status,
        dueAt: requests.dueAt,
        sentAt: requests.sentAt,
        closedAt: requests.closedAt,
        templateName: templates.name,
        recipientCount: sql<number>`coalesce(${requestSubmissionAggregates.recipientCount}, 0)`,
        completedItems: sql<number>`coalesce(${requestSubmissionAggregates.completedItems}, 0)`,
        totalItems: sql<number>`coalesce(${requestSubmissionAggregates.totalItems}, 0)`,
        ownerUserId: users.id,
        ownerUserFullName: users.fullName,
        ownerUserEmail: users.email,
        createdAt: requests.createdAt,
        updatedAt: requests.updatedAt,
      })
      .from(requests)
      .innerJoin(templates, eq(templates.id, requests.templateId))
      .leftJoin(users, eq(users.id, requests.createdByUserId))
      .leftJoin(
        requestSubmissionAggregates,
        eq(requestSubmissionAggregates.requestId, requests.id),
      )
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

    return this.serializeRequestReadModel(requestRow);
  }

  async createRequest(input: CreateRequestInput) {
    await this.organizationEntitlementsService.assertWithinLimit(
      input.organizationId,
      'activeRequests',
      1,
    );

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
        overdueNotifiedAt:
          action === 'reopen' ? null : requestRow.overdueNotifiedAt,
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

    if (action === 'send' || action === 'reopen') {
      await this.syncRequestLifecycleSignals(
        requestId,
        input.organizationId,
        now,
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

  async sendRequestReminder(
    requestId: string,
    input: SendRequestReminderInput,
  ) {
    if (input.channel === 'sms' || input.channel === 'email') {
      await this.organizationEntitlementsService.assertWithinLimit(
        input.organizationId,
        input.channel === 'sms' ? 'smsPerMonth' : 'emailPerMonth',
        1,
      );
    }

    const db = this.getDatabase();

    const [requestRow] = await db
      .select({
        id: requests.id,
        requestCode: requests.requestCode,
        status: requests.status,
        workspaceId: requests.workspaceId,
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

    if (requestRow.status === 'closed' || requestRow.status === 'cancelled') {
      throw new ConflictException(
        `Cannot remind a request in status ${requestRow.status}.`,
      );
    }

    const reminderResult = await this.remindersService.dispatchReminder({
      organizationId: input.organizationId,
      requestId,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject,
      message: input.message,
      templateKey: input.templateKey,
      templateVariables: input.templateVariables,
      locale: input.locale,
      metadata: input.metadata,
    });

    await this.auditLogService.record({
      category: 'data_access',
      channel: this.mapReminderChannelToAuditChannel(input.channel),
      action: AUDIT_ACTIONS.data_access.requestReminderSent,
      organizationId: input.organizationId,
      actorId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.automation.reminderDispatch,
      resourceId: reminderResult.externalMessageId,
      metadata: {
        requestId,
        requestCode: requestRow.requestCode,
        status: requestRow.status,
        channel: input.channel,
        provider: reminderResult.provider,
        recipient: input.recipient,
        templateKey: input.templateKey ?? null,
        locale: input.locale ?? null,
        providerMetadata: reminderResult.metadata,
        contextMetadata: input.metadata ?? {},
      },
    });

    await this.webhookService.emitEvent(
      WEBHOOK_EVENTS.requests.reminderSent,
      {
        requestId,
        requestCode: requestRow.requestCode,
        workspaceId: requestRow.workspaceId,
        status: requestRow.status,
        channel: input.channel,
        provider: reminderResult.provider,
        externalMessageId: reminderResult.externalMessageId,
      },
      input.organizationId,
    );

    return {
      requestId,
      channel: input.channel,
      provider: reminderResult.provider,
      externalMessageId: reminderResult.externalMessageId,
      acceptedAt: reminderResult.acceptedAt,
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

    await this.webhookService.emitEvent(
      WEBHOOK_EVENTS.requests.viewed,
      {
        requestId: portalLink.requestId,
        submissionId: portalLink.submissionId,
        recipientId: portalLink.recipientId,
        portalLinkId: portalLink.id,
      },
      portalLink.organizationId,
    );

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

  async approveSubmissionItem(
    itemId: string,
    input: ReviewSubmissionItemInput,
  ) {
    return this.reviewSubmissionItem(itemId, 'approved', input);
  }

  async rejectSubmissionItem(itemId: string, input: ReviewSubmissionItemInput) {
    return this.reviewSubmissionItem(itemId, 'rejected', input);
  }

  async createSubmissionItemComment(
    itemId: string,
    input: CreateSubmissionItemCommentInput,
  ) {
    const db = this.getDatabase();
    const now = new Date();
    const normalizedBody = input.body.trim();

    if (normalizedBody.length === 0) {
      throw new BadRequestException('Comment body cannot be empty.');
    }

    const submissionItem = await this.getSubmissionItemContext(
      itemId,
      input.organizationId,
    );

    const commentId = randomUUID();

    await db.insert(comments).values({
      id: commentId,
      organizationId: input.organizationId,
      requestId: submissionItem.requestId,
      submissionId: submissionItem.submissionId,
      submissionItemId: itemId,
      authorType: input.authorType,
      authorId: input.authorId,
      body: normalizedBody,
      metadata: input.metadata ?? {},
      createdAt: now,
    });

    await this.auditLogService.record({
      category: 'data_access',
      action: AUDIT_ACTIONS.data_access.commentCreated,
      organizationId: input.organizationId,
      actorType: input.authorType,
      actorId: input.authorId,
      resourceType: RESOURCE_TYPES.documents.comment,
      resourceId: commentId,
      metadata: {
        requestId: submissionItem.requestId,
        submissionId: submissionItem.submissionId,
        submissionItemId: itemId,
      },
    });

    await this.webhookService.emitEvent(
      WEBHOOK_EVENTS.comments.created,
      {
        commentId,
        requestId: submissionItem.requestId,
        submissionId: submissionItem.submissionId,
        submissionItemId: itemId,
        authorType: input.authorType,
      },
      input.organizationId,
    );

    return {
      id: commentId,
      submissionItemId: itemId,
      submissionId: submissionItem.submissionId,
      requestId: submissionItem.requestId,
      authorType: input.authorType,
      authorId: input.authorId ?? null,
      body: normalizedBody,
      createdAt: now.toISOString(),
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

    const submissionProgress = await this.recalculateSubmissionProgress(
      submissionId,
      submission.status,
      now,
    );

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
        progressPercent: submissionProgress.progressPercent,
        submissionStatus: submissionProgress.status,
      },
    });

    await this.webhookService.emitEvent(
      WEBHOOK_EVENTS.submissions.updated,
      {
        submissionId,
        requestId: submission.requestId,
        progressPercent: submissionProgress.progressPercent,
        status: submissionProgress.status,
      },
      input.organizationId,
    );

    await this.syncRequestLifecycleSignals(
      submission.requestId,
      input.organizationId,
      now,
    );

    return {
      submissionId,
      status: submissionProgress.status,
      progressPercent: submissionProgress.progressPercent,
      answeredItems: distinctItemIds.length,
      totalItems: submissionProgress.totalItems,
      completedItems: submissionProgress.completedItems,
      updatedAt: now.toISOString(),
    };
  }

  async assertPortalSubmissionAccess(input: {
    organizationId: string;
    recipientId?: string | null;
    requestId: string;
    submissionId: string;
    tokenSubmissionId?: string | null;
  }) {
    const db = this.getDatabase();
    const [submission] = await db
      .select({
        id: submissions.id,
        recipientId: submissions.recipientId,
        requestId: submissions.requestId,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.id, input.submissionId),
          eq(submissions.organizationId, input.organizationId),
        ),
      )
      .limit(1);

    if (!submission) {
      throw new NotFoundException('Submission not found.');
    }

    if (submission.requestId !== input.requestId) {
      throw new ForbiddenException(
        'Portal token is not valid for this submission.',
      );
    }

    if (input.tokenSubmissionId && submission.id !== input.tokenSubmissionId) {
      throw new ForbiddenException(
        'Portal token is not valid for this submission.',
      );
    }

    if (input.recipientId && submission.recipientId !== input.recipientId) {
      throw new ForbiddenException(
        'Portal token is not valid for this recipient.',
      );
    }

    return submission;
  }

  async assertPortalSubmissionItemAccess(input: {
    organizationId: string;
    requestId: string;
    submissionId: string;
    submissionItemId: string;
  }) {
    const submissionItem = await this.getSubmissionItemContext(
      input.submissionItemId,
      input.organizationId,
    );

    if (
      submissionItem.submissionId !== input.submissionId ||
      submissionItem.requestId !== input.requestId
    ) {
      throw new ForbiddenException(
        'Portal token is not valid for this submission item.',
      );
    }

    return submissionItem;
  }

  private async reviewSubmissionItem(
    itemId: string,
    decision: ReviewDecisionType,
    input: ReviewSubmissionItemInput,
  ) {
    const db = this.getDatabase();
    const now = new Date();
    const normalizedNote = input.note?.trim() || null;

    if (decision === 'rejected' && !normalizedNote) {
      throw new BadRequestException('Reject flow requires a note.');
    }

    const submissionItem = await this.getSubmissionItemContext(
      itemId,
      input.organizationId,
    );

    this.assertReviewTransitionAllowed(submissionItem.status, decision);

    const nextItemStatus: SubmissionItemStatus =
      decision === 'approved' ? 'approved' : 'rejected';

    await db
      .update(submissionItems)
      .set({
        status: nextItemStatus,
        note: normalizedNote ?? submissionItem.note,
        updatedAt: now,
      })
      .where(eq(submissionItems.id, itemId));

    const reviewDecisionId = randomUUID();

    await db.insert(reviewDecisions).values({
      id: reviewDecisionId,
      organizationId: input.organizationId,
      requestId: submissionItem.requestId,
      submissionId: submissionItem.submissionId,
      submissionItemId: itemId,
      decision,
      reviewerId: input.reviewerId,
      note: normalizedNote,
      metadata: input.metadata ?? {},
      createdAt: now,
    });

    const submissionProgress = await this.recalculateSubmissionProgress(
      submissionItem.submissionId,
      submissionItem.submissionStatus,
      now,
    );

    await this.auditLogService.record({
      category: 'data_access',
      action:
        decision === 'approved'
          ? AUDIT_ACTIONS.data_access.submissionItemApproved
          : AUDIT_ACTIONS.data_access.submissionItemRejected,
      organizationId: input.organizationId,
      actorType: 'reviewer',
      actorId: input.reviewerId,
      resourceType: RESOURCE_TYPES.documents.reviewDecision,
      resourceId: reviewDecisionId,
      metadata: {
        requestId: submissionItem.requestId,
        submissionId: submissionItem.submissionId,
        submissionItemId: itemId,
        fromStatus: submissionItem.status,
        toStatus: nextItemStatus,
        submissionStatus: submissionProgress.status,
        progressPercent: submissionProgress.progressPercent,
      },
    });

    await this.webhookService.emitEvent(
      decision === 'approved'
        ? WEBHOOK_EVENTS.reviews.approved
        : WEBHOOK_EVENTS.reviews.rejected,
      {
        reviewDecisionId,
        requestId: submissionItem.requestId,
        submissionId: submissionItem.submissionId,
        submissionItemId: itemId,
        status: nextItemStatus,
        submissionStatus: submissionProgress.status,
        progressPercent: submissionProgress.progressPercent,
      },
      input.organizationId,
    );

    await this.syncRequestLifecycleSignals(
      submissionItem.requestId,
      input.organizationId,
      now,
    );

    return {
      reviewDecisionId,
      decision,
      submissionItemId: itemId,
      submissionId: submissionItem.submissionId,
      requestId: submissionItem.requestId,
      status: nextItemStatus,
      note: normalizedNote ?? submissionItem.note,
      reviewerId: input.reviewerId ?? null,
      submissionStatus: submissionProgress.status,
      progressPercent: submissionProgress.progressPercent,
      reviewedAt: now.toISOString(),
    };
  }

  private async getSubmissionItemContext(
    itemId: string,
    organizationId: string,
  ) {
    const db = this.getDatabase();

    const [submissionItem] = await db
      .select({
        id: submissionItems.id,
        submissionId: submissionItems.submissionId,
        status: submissionItems.status,
        note: submissionItems.note,
        requestId: submissions.requestId,
        submissionStatus: submissions.status,
      })
      .from(submissionItems)
      .innerJoin(submissions, eq(submissions.id, submissionItems.submissionId))
      .where(
        and(
          eq(submissionItems.id, itemId),
          eq(submissionItems.organizationId, organizationId),
          eq(submissions.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!submissionItem) {
      throw new NotFoundException('Submission item not found.');
    }

    return submissionItem;
  }

  private async recalculateSubmissionProgress(
    submissionId: string,
    previousStatus: SubmissionStatus,
    now: Date,
  ) {
    const db = this.getDatabase();

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
        : previousStatus === 'completed'
          ? 'reopened'
          : previousStatus === 'reopened'
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

    return {
      status: nextSubmissionStatus,
      progressPercent,
      totalItems,
      completedItems,
    };
  }

  private async syncRequestLifecycleSignals(
    requestId: string,
    organizationId: string,
    now: Date,
  ): Promise<void> {
    const db = this.getDatabase();

    const [requestRow] = await db
      .select({
        id: requests.id,
        requestCode: requests.requestCode,
        status: requests.status,
        dueAt: requests.dueAt,
        overdueNotifiedAt: requests.overdueNotifiedAt,
        workspaceId: requests.workspaceId,
      })
      .from(requests)
      .where(
        and(
          eq(requests.id, requestId),
          eq(requests.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!requestRow) {
      return;
    }

    const [totalSubmissionsRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(submissions)
      .where(eq(submissions.requestId, requestId));

    const [completedSubmissionsRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(submissions)
      .where(
        and(
          eq(submissions.requestId, requestId),
          eq(submissions.status, 'completed'),
        ),
      );

    const totalSubmissions = Number(totalSubmissionsRow?.count ?? 0);
    const completedSubmissions = Number(completedSubmissionsRow?.count ?? 0);
    const allSubmissionsCompleted =
      totalSubmissions > 0 && completedSubmissions === totalSubmissions;

    let nextStatus = requestRow.status;

    if (requestRow.status !== 'closed' && requestRow.status !== 'cancelled') {
      if (allSubmissionsCompleted) {
        nextStatus = 'completed';
      } else if (requestRow.status === 'completed') {
        nextStatus = 'in_progress';
      }
    }

    const shouldEmitCompleted =
      requestRow.status !== 'completed' && nextStatus === 'completed';

    const shouldEmitOverdue =
      requestRow.dueAt !== null &&
      requestRow.dueAt.getTime() < now.getTime() &&
      requestRow.overdueNotifiedAt === null &&
      !['completed', 'closed', 'cancelled'].includes(nextStatus);

    const updateValues: {
      overdueNotifiedAt?: Date | null;
      status?: RequestStatus;
      updatedAt?: Date;
    } = {};

    if (nextStatus !== requestRow.status) {
      updateValues.status = nextStatus;
      updateValues.updatedAt = now;
    }

    if (shouldEmitOverdue) {
      updateValues.overdueNotifiedAt = now;
      updateValues.updatedAt = now;
    }

    if (Object.keys(updateValues).length > 0) {
      await db
        .update(requests)
        .set(updateValues)
        .where(eq(requests.id, requestId));
    }

    if (shouldEmitCompleted) {
      await this.webhookService.emitEvent(
        WEBHOOK_EVENTS.requests.completed,
        {
          requestId,
          requestCode: requestRow.requestCode,
          status: nextStatus,
          workspaceId: requestRow.workspaceId,
          totalSubmissions,
          completedSubmissions,
        },
        organizationId,
      );
    }

    if (shouldEmitOverdue) {
      await this.webhookService.emitEvent(
        WEBHOOK_EVENTS.requests.overdue,
        {
          requestId,
          requestCode: requestRow.requestCode,
          status: nextStatus,
          dueAt: requestRow.dueAt?.toISOString() ?? null,
        },
        organizationId,
      );
    }
  }

  private serializeRequestReadModel(
    row: RequestReadModelRow,
  ): RequestReadModel {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      clientId: row.clientId,
      templateId: row.templateId,
      templateVersionId: row.templateVersionId,
      requestCode: row.requestCode,
      title: row.title,
      message: row.message,
      status: row.status,
      dueAt: row.dueAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      templateName: row.templateName,
      recipientCount: Number(row.recipientCount ?? 0),
      completedItems: Number(row.completedItems ?? 0),
      totalItems: Number(row.totalItems ?? 0),
      ownerUser:
        row.ownerUserId && row.ownerUserFullName && row.ownerUserEmail
          ? {
              id: row.ownerUserId,
              fullName: row.ownerUserFullName,
              email: row.ownerUserEmail,
            }
          : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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

  private assertReviewTransitionAllowed(
    currentStatus: SubmissionItemStatus,
    decision: ReviewDecisionType,
  ) {
    const allowedStatuses: Record<ReviewDecisionType, SubmissionItemStatus[]> =
      {
        approved: ['provided', 'rejected', 'changes_requested', 'approved'],
        rejected: ['provided', 'approved', 'changes_requested', 'rejected'],
      };

    if (!allowedStatuses[decision].includes(currentStatus)) {
      throw new ConflictException(
        `Cannot ${decision} submission item from status ${currentStatus}.`,
      );
    }
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

  private mapReminderChannelToAuditChannel(
    channel: ReminderChannel,
  ): AuditChannel {
    if (channel === 'email' || channel === 'sms' || channel === 'whatsapp') {
      return channel;
    }

    return 'api';
  }
}
