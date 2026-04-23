export const CLIENT_STATUS_VALUES = ['active', 'archived'] as const;

export type ClientStatus = (typeof CLIENT_STATUS_VALUES)[number];

export interface ClientRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  displayName: string;
  legalName: string | null;
  externalRef: string | null;
  status: ClientStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface CreateClientInput {
  organizationId: string;
  workspaceId: string;
  displayName: string;
  legalName?: string;
  externalRef?: string;
  metadata?: Record<string, unknown>;
  actorUserId: string;
}

export interface UpdateClientInput {
  organizationId: string;
  displayName?: string;
  legalName?: string;
  externalRef?: string;
  metadata?: Record<string, unknown>;
  status?: ClientStatus;
  actorUserId: string;
}
