import type { IntegrationProviderKey } from './integration-types';

export interface IntegrationExternalReferenceLookup {
  localResourceType: string;
  localResourceId: string;
  externalObjectType: string;
}

export interface IntegrationExternalReferenceSnapshot
  extends IntegrationExternalReferenceLookup {
  externalId: string;
  externalReferenceKey?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationExternalReferenceRecord
  extends IntegrationExternalReferenceLookup {
  id: string;
  organizationId: string;
  connectionId: string;
  providerKey: IntegrationProviderKey;
  externalId: string;
  externalReferenceKey: string | null;
  metadata: Record<string, unknown>;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}