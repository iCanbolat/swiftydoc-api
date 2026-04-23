export const TEMPLATE_STATUS_VALUES = [
  'draft',
  'published',
  'archived',
] as const;

export type TemplateStatus = (typeof TEMPLATE_STATUS_VALUES)[number];

export interface TemplateRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  status: TemplateStatus;
  publishedVersionNumber: number | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface CreateTemplateInput {
  organizationId: string;
  workspaceId: string;
  name: string;
  slug: string;
  description?: string;
  status?: TemplateStatus;
  actorUserId: string;
}

export interface UpdateTemplateInput {
  organizationId: string;
  name?: string;
  slug?: string;
  description?: string;
  status?: TemplateStatus;
  actorUserId: string;
}
