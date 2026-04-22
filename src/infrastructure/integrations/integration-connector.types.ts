import type {
  IntegrationExternalReferenceRecord,
  IntegrationExternalReferenceSnapshot,
} from '../../common/integrations/integration-external-reference';
import type {
  IntegrationProviderKey,
  SyncJobStatus,
} from '../../common/integrations/integration-types';
import type { IntegrationSyncPayload } from '../../common/integrations/integration-sync-payload';

export interface IntegrationArtifact {
  body: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey?: string;
}

export interface IntegrationConnectorContext {
  connectionId: string;
  organizationId: string;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  syncPayload?: IntegrationSyncPayload;
  targetResourceType?: string | null;
  targetResourceId?: string | null;
  externalReference?: IntegrationExternalReferenceRecord | null;
  artifact?: IntegrationArtifact;
}

export interface IntegrationConnectionTestResult {
  success: boolean;
  status: 'connected' | 'degraded';
  mode: 'live' | 'simulated';
  message: string;
  metadata: Record<string, unknown>;
}

export interface IntegrationSyncResult {
  status: Extract<SyncJobStatus, 'succeeded' | 'partial_success'>;
  mode: 'live' | 'simulated';
  message: string;
  metadata: Record<string, unknown>;
  externalReference?: IntegrationExternalReferenceSnapshot;
}

export interface IntegrationConnector {
  readonly providerKey: IntegrationProviderKey;

  testConnection(
    context: IntegrationConnectorContext,
  ): Promise<IntegrationConnectionTestResult>;

  sync(context: IntegrationConnectorContext): Promise<IntegrationSyncResult>;
}
