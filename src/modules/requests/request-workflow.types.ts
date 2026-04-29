import type { PortalLinkPurpose } from '../../common/portal/portal-link-types';
import type { ReminderChannel } from '../../common/reminders/reminder-types';
import type { PaginationParams } from '../../common/http/pagination.dto';
import type { RequestStatus } from '../../common/requests/request-workflow';

export type AnswerActorType = 'recipient' | 'reviewer' | 'system' | 'user';

export type AnswerSource = 'portal' | 'api';

export type ReviewDecisionType = 'approved' | 'rejected';

export type CommentAuthorType = 'reviewer' | 'recipient' | 'system';

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

export interface ReviewSubmissionItemInput {
  organizationId: string;
  reviewerId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSubmissionItemCommentInput {
  organizationId: string;
  body: string;
  authorType: CommentAuthorType;
  authorId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendRequestReminderInput {
  organizationId: string;
  actorUserId?: string;
  channel: ReminderChannel;
  recipient: string;
  subject?: string;
  message?: string;
  templateKey?: string;
  templateVariables?: Record<string, unknown>;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export interface ListRequestsInput {
  organizationId: string;
  workspaceId: string;
  clientId?: string;
  status?: RequestStatus;
  pagination: PaginationParams;
}

export interface RequestReadModel {
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
  dueAt: string | null;
  sentAt: string | null;
  closedAt: string | null;
  templateName: string;
  recipientCount: number;
  completedItems: number;
  totalItems: number;
  ownerUser: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}
