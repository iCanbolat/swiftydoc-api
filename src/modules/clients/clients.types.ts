import type { PaginationParams } from '../../common/http/pagination.dto';

export const CLIENT_STATUS_VALUES = ['active', 'archived'] as const;

export const CLIENT_DETAIL_INCLUDE_VALUES = [
  'summary',
  'contactsPreview',
  'requestHistory',
] as const;

export type ClientStatus = (typeof CLIENT_STATUS_VALUES)[number];

export type ClientDetailInclude = (typeof CLIENT_DETAIL_INCLUDE_VALUES)[number];

export interface ClientRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  displayName: string;
  legalName: string | null;
  externalRef: string | null;
  province: string | null;
  district: string | null;
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
  province?: string;
  district?: string;
  metadata?: Record<string, unknown>;
  actorUserId: string;
}

export interface ListClientsInput {
  organizationId: string;
  pagination: PaginationParams;
  province?: string;
  search?: string;
  status?: ClientStatus;
  workspaceId: string;
}

export interface UpdateClientInput {
  organizationId: string;
  displayName?: string;
  legalName?: string;
  externalRef?: string;
  province?: string;
  district?: string;
  metadata?: Record<string, unknown>;
  status?: ClientStatus;
  actorUserId: string;
}
