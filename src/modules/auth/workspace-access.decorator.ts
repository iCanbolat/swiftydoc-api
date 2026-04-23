import { SetMetadata } from '@nestjs/common';

export const WORKSPACE_ACCESS_METADATA_KEY = 'workspace_access';

export type WorkspaceValueSource = 'body' | 'param' | 'query';

export type WorkspaceAccessResource =
  | 'client'
  | 'exportContext'
  | 'exportJob'
  | 'fileContext'
  | 'fileId'
  | 'request'
  | 'storageKey'
  | 'submission'
  | 'submissionItem'
  | 'template'
  | 'workspace';

export interface WorkspaceAccessOptions {
  fallbackToActiveWorkspace?: boolean;
  key?: string;
  resource: WorkspaceAccessResource;
  source?: WorkspaceValueSource;
}

export const WorkspaceAccess = (options: WorkspaceAccessOptions) =>
  SetMetadata(WORKSPACE_ACCESS_METADATA_KEY, options);
