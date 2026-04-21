import type {
  AuditActionForCategory,
  AuditCategory,
} from '../../common/audit/audit-actions';
import type { ResourceType } from '../../common/audit/resource-types';

interface AuditLogEntryBase {
  organizationId?: string;
  actorType?: string;
  actorId?: string;
  resourceType?: ResourceType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

type AuditLogEntryForCategory<C extends AuditCategory> = AuditLogEntryBase & {
  action: AuditActionForCategory<C>;
  category: C;
};

export type AuditLogEntry = {
  [Category in AuditCategory]: AuditLogEntryForCategory<Category>;
}[AuditCategory];
