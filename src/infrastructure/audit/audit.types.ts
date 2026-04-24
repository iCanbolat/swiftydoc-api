import type {
  AuditActionForCategory,
  AuditCategory,
} from '../../common/audit/audit-actions';
import type { AuditChannel } from '../../common/audit/audit-channel';
import type { ResourceType } from '../../common/audit/resource-types';

export const AUDIT_AUTH_SURFACE_VALUES = [
  'internal',
  'portal',
  'public',
  'system',
] as const;

export type AuditAuthSurface = (typeof AUDIT_AUTH_SURFACE_VALUES)[number];

export interface AuditSecurityContext {
  activeWorkspaceId: string | null;
  authSurface: AuditAuthSurface;
  impersonatorActorId: string | null;
  impersonatorSessionId: string | null;
  sessionId: string | null;
}

interface AuditLogEntryBase {
  activeWorkspaceId?: string | null;
  authSurface?: AuditAuthSurface;
  organizationId?: string;
  channel?: AuditChannel;
  actorType?: string;
  actorId?: string;
  impersonatorActorId?: string | null;
  impersonatorSessionId?: string | null;
  resourceType?: ResourceType;
  resourceId?: string;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
}

type AuditLogEntryForCategory<C extends AuditCategory> = AuditLogEntryBase & {
  action: AuditActionForCategory<C>;
  category: C;
};

export type AuditLogEntry = {
  [Category in AuditCategory]: AuditLogEntryForCategory<Category>;
}[AuditCategory];
