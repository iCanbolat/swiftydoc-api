import type {
  IntegrationAuthType,
  IntegrationConnectionStatus,
  IntegrationProviderKey,
  SyncJobStatus,
  SyncJobType,
} from '../../common/integrations/integration-types';
import type { IntegrationSyncPayload } from '../../common/integrations/integration-sync-payload';
import type {
  IntegrationConnectionTestResult,
  IntegrationSyncResult,
} from '../../infrastructure/integrations/integration-connector.types';
import type { IntegrationProviderCatalogEntry } from './integrations.constants';

export interface CreateIntegrationConnectionInput {
  organizationId: string;
  workspaceId?: string;
  providerKey: IntegrationProviderKey;
  authType?: IntegrationAuthType;
  credentialsRef?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  actorUserId?: string;
}

export interface TestIntegrationConnectionInput {
  organizationId: string;
  actorUserId?: string;
}

export interface QueueIntegrationSyncInput {
  organizationId: string;
  actorUserId?: string;
  targetResourceType?: string;
  targetResourceId?: string;
  payload?: IntegrationSyncPayload;
}

export interface ListSyncJobsInput {
  organizationId: string;
  connectionId?: string;
  status?: SyncJobStatus;
}

export interface IntegrationSyncQueuePayload {
  syncJobId: string;
}

export interface IntegrationConnectionRecord {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  providerKey: IntegrationProviderKey;
  authType: IntegrationAuthType;
  credentialsRef: string | null;
  status: IntegrationConnectionStatus;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  errorMessage: string | null;
  lastTestedAt: Date | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncJobRecord {
  id: string;
  organizationId: string;
  connectionId: string;
  jobType: SyncJobType;
  targetResourceType: string | null;
  targetResourceId: string | null;
  status: SyncJobStatus;
  attemptCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  payload: IntegrationSyncPayload;
  result: Record<string, unknown>;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface TriggeredSyncJobResult {
  syncJob: SyncJobRecord;
  queueJobId: string;
}

export interface TestedIntegrationConnectionResult {
  connection: IntegrationConnectionRecord;
  result: IntegrationConnectionTestResult;
}

export interface ProcessedSyncJobResult {
  syncJob: SyncJobRecord;
  result: IntegrationSyncResult;
}

export interface IntegrationProviderListItem extends IntegrationProviderCatalogEntry {}