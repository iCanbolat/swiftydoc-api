export const WORKSPACE_STATUS_VALUES = [
  'active',
  'disabled',
  'archived',
] as const;

export type WorkspaceStatus = (typeof WORKSPACE_STATUS_VALUES)[number];

export interface CreateWorkspaceInput {
  actorUserId?: string;
  code: string;
  name: string;
  organizationId: string;
  status?: WorkspaceStatus;
}

export interface UpdateWorkspaceInput {
  actorUserId?: string;
  code?: string;
  name?: string;
  organizationId: string;
  status?: WorkspaceStatus;
}

export interface WorkspaceView {
  code: string;
  createdAt: string;
  id: string;
  name: string;
  organizationId: string;
  status: WorkspaceStatus;
}
