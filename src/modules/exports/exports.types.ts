import type { ExportJobType } from '../../common/exports/export-types';
import type { IntegrationProviderKey } from '../../common/integrations/integration-types';

export const EXPORT_ARTIFACT_DELIVERY_STATUS_VALUES = [
  'not_configured',
  'delivered',
  'partial_failure',
  'failed',
] as const;

export type ExportArtifactDeliveryStatus =
  (typeof EXPORT_ARTIFACT_DELIVERY_STATUS_VALUES)[number];

export interface ExportArtifactDeliveryTarget {
  connectionId: string;
  driveId?: string;
  fileName?: string;
  folderId?: string;
  itemId?: string;
  path?: string;
  siteId?: string;
}

export interface ExportArtifactDeliveryResult {
  connectionId: string;
  deliveredAt: string;
  providerKey: IntegrationProviderKey | string;
  status: 'delivered' | 'failed';
  remoteFileId?: string | null;
  remoteFileName?: string | null;
  remoteFileUrl?: string | null;
  errorMessage?: string | null;
}

export interface ExportJobMetadata extends Record<string, unknown> {
  includeFiles?: boolean;
  locale?: string;
  deliveryTargets?: ExportArtifactDeliveryTarget[];
  deliveryResults?: ExportArtifactDeliveryResult[];
  deliveryStatus?: ExportArtifactDeliveryStatus;
  deliveryReplayCount?: number;
  lastDeliveryReplayAt?: string;
}

export interface CreateExportJobInput {
  organizationId: string;
  exportType: ExportJobType;
  requestId?: string;
  submissionId?: string;
  requestedByUserId?: string;
  includeFiles?: boolean;
  deliveryTargets?: ExportArtifactDeliveryTarget[];
  metadata?: ExportJobMetadata;
}

export interface ReplayExportDeliveryInput {
  organizationId: string;
  actorUserId?: string;
  connectionIds?: string[];
  failedOnly?: boolean;
}

export interface ExportGenerationJobPayload {
  exportJobId: string;
  organizationId: string;
}

export interface GeneratedArtifact {
  buffer: Buffer;
  extension: 'zip' | 'pdf' | 'csv';
  mimeType: 'application/zip' | 'application/pdf' | 'text/csv';
}

export interface FileAssetExportRow {
  fileId: string;
  requestId: string | null;
  submissionId: string | null;
  submissionItemId: string | null;
  originalFileName: string;
  normalizedFileName: string;
  detectedMimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKey: string;
  createdAt: Date;
}
