import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import type { IntegrationExternalReferenceSnapshot } from '../../common/integrations/integration-external-reference';
import { isStorageExportSyncPayload } from '../../common/integrations/integration-sync-payload';
import type {
  IntegrationConnectionTestResult,
  IntegrationConnector,
  IntegrationConnectorContext,
  IntegrationSyncResult,
} from './integration-connector.types';

interface GoogleDriveCredentials {
  accessToken?: string;
  apiBaseUrl: string;
  folderId?: string;
}

interface GoogleDriveAboutResponse {
  error?: {
    message?: string;
  };
  storageQuota?: {
    limit?: string;
    usage?: string;
  };
  user?: {
    displayName?: string;
    emailAddress?: string;
  };
}

interface GoogleDriveFileResponse {
  id?: string;
  mimeType?: string;
  name?: string;
  webViewLink?: string;
}

interface GoogleDriveUploadResponse
  extends GoogleDriveAboutResponse, GoogleDriveFileResponse {}

@Injectable()
export class GoogleDriveIntegrationConnector implements IntegrationConnector {
  readonly providerKey = 'google_drive' as const;

  constructor(
    private readonly configService: ConfigService<RuntimeEnv, true>,
  ) {}

  async testConnection(
    context: IntegrationConnectorContext,
  ): Promise<IntegrationConnectionTestResult> {
    const credentials = this.resolveCredentials(context.settings);

    if (!credentials.accessToken) {
      if (this.isProduction()) {
        throw new ServiceUnavailableException(
          'Google Drive access token is missing for production integration testing.',
        );
      }

      return {
        success: true,
        status: 'connected',
        mode: 'simulated',
        message: 'Simulated Google Drive connection test succeeded.',
        metadata: {
          mode: 'simulated',
          reason: 'missing_credentials',
        },
      };
    }

    const aboutResponse = await fetch(
      `${credentials.apiBaseUrl.replace(/\/$/, '')}/about?fields=user,storageQuota`,
      {
        method: 'GET',
        headers: this.buildHeaders(credentials.accessToken),
      },
    );
    const about = await this.parseJson<GoogleDriveAboutResponse>(aboutResponse);

    if (!aboutResponse.ok) {
      throw new ServiceUnavailableException(
        `Google Drive connection test failed (${aboutResponse.status}): ${about.error?.message ?? 'Unknown provider error'}`,
      );
    }

    const folder = credentials.folderId
      ? await this.fetchFileMetadata(credentials, credentials.folderId)
      : null;

    return {
      success: true,
      status: 'connected',
      mode: 'live',
      message: 'Google Drive connection test succeeded.',
      metadata: {
        folderId: folder?.id ?? credentials.folderId ?? null,
        folderMimeType: folder?.mimeType ?? null,
        folderName: folder?.name ?? null,
        folderUrl: folder?.webViewLink ?? null,
        storageLimitBytes: about.storageQuota?.limit ?? null,
        storageUsageBytes: about.storageQuota?.usage ?? null,
        userDisplayName: about.user?.displayName ?? null,
        userEmailAddress: about.user?.emailAddress ?? null,
      },
    };
  }

  async sync(
    context: IntegrationConnectorContext,
  ): Promise<IntegrationSyncResult> {
    const testResult = await this.testConnection(context);
    const credentials = this.resolveCredentials(context.settings);

    if (
      testResult.mode === 'live' &&
      isStorageExportSyncPayload(context.syncPayload) &&
      context.artifact
    ) {
      const remoteFile = await this.uploadArtifact(credentials, context);

      return {
        status: 'succeeded',
        mode: 'live',
        message: 'Google Drive export artifact delivery completed.',
        metadata: {
          ...testResult.metadata,
          remoteFileId: remoteFile.id ?? null,
          remoteFileMimeType: remoteFile.mimeType ?? null,
          remoteFileName: remoteFile.name ?? context.artifact.fileName,
          remoteFileUrl: remoteFile.webViewLink ?? null,
          syncScope: 'export_artifact',
        },
        externalReference:
          remoteFile.id && context.syncPayload
            ? this.buildExternalReference(
                context,
                remoteFile.id,
                remoteFile.name,
                remoteFile.webViewLink,
              )
            : undefined,
      };
    }

    return {
      status: 'succeeded',
      mode: testResult.mode,
      message: 'Google Drive metadata sync completed.',
      metadata: {
        ...testResult.metadata,
        syncScope: credentials.folderId ? 'folder_profile' : 'drive_profile',
      },
    };
  }

  private async fetchFileMetadata(
    credentials: GoogleDriveCredentials,
    fileId: string,
  ): Promise<GoogleDriveFileResponse> {
    const response = await fetch(
      `${credentials.apiBaseUrl.replace(/\/$/, '')}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink`,
      {
        method: 'GET',
        headers: this.buildHeaders(credentials.accessToken),
      },
    );
    const responseBody = await this.parseJson<
      GoogleDriveAboutResponse & GoogleDriveFileResponse
    >(response);

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Google Drive folder lookup failed (${response.status}): ${responseBody.error?.message ?? 'Unknown provider error'}`,
      );
    }

    return responseBody;
  }

  private async uploadArtifact(
    credentials: GoogleDriveCredentials,
    context: IntegrationConnectorContext,
  ): Promise<GoogleDriveUploadResponse> {
    const artifact = context.artifact;
    const payload = context.syncPayload;

    if (!artifact || !isStorageExportSyncPayload(payload)) {
      throw new ServiceUnavailableException(
        'Google Drive artifact upload requires a storage export payload and artifact body.',
      );
    }

    if (!credentials.accessToken) {
      throw new ServiceUnavailableException(
        'Google Drive access token is required for artifact delivery.',
      );
    }

    const boundary = `swiftydoc_${Date.now().toString(36)}`;
    const metadata = {
      mimeType: artifact.mimeType,
      name: artifact.fileName,
      ...((payload.destination?.folderId ?? credentials.folderId)
        ? {
            parents: [payload.destination?.folderId ?? credentials.folderId],
          }
        : {}),
    };
    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      ),
      Buffer.from(
        `--${boundary}\r\nContent-Type: ${artifact.mimeType}\r\n\r\n`,
      ),
      artifact.body,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const externalId = context.externalReference?.externalId?.trim();
    const isUpdate = typeof externalId === 'string' && externalId.length > 0;
    const method = isUpdate ? 'PATCH' : 'POST';
    const endpoint = isUpdate
      ? `${credentials.apiBaseUrl.replace(/\/$/, '')}/files/${encodeURIComponent(externalId)}`
      : `${credentials.apiBaseUrl.replace(/\/$/, '')}/files`;
    const response = await fetch(
      `${endpoint}?uploadType=multipart&fields=id,name,mimeType,webViewLink`,
      {
        method,
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      },
    );
    const responseBody =
      await this.parseJson<GoogleDriveUploadResponse>(response);

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Google Drive artifact upload failed (${response.status}): ${responseBody.error?.message ?? 'Unknown provider error'}`,
      );
    }

    return responseBody;
  }

  private buildExternalReference(
    context: IntegrationConnectorContext,
    externalId: string,
    remoteFileName?: string,
    remoteFileUrl?: string,
  ): IntegrationExternalReferenceSnapshot {
    const payload = context.syncPayload;

    if (!payload || !isStorageExportSyncPayload(payload)) {
      throw new ServiceUnavailableException(
        'Google Drive external reference requires a storage export payload.',
      );
    }

    return {
      externalId,
      externalObjectType: payload.entityType,
      localResourceId: payload.source.resourceId,
      localResourceType: payload.source.resourceType,
      metadata: {
        remoteFileName: remoteFileName ?? null,
        remoteFileUrl: remoteFileUrl ?? null,
      },
    };
  }

  private resolveCredentials(
    source: Record<string, unknown>,
  ): GoogleDriveCredentials {
    return {
      accessToken:
        this.readString(source, 'accessToken') ??
        this.configService.get('GOOGLE_DRIVE_ACCESS_TOKEN', { infer: true }),
      apiBaseUrl:
        this.readString(source, 'apiBaseUrl') ??
        this.configService.get('GOOGLE_DRIVE_API_BASE_URL', { infer: true }) ??
        'https://www.googleapis.com/drive/v3',
      folderId:
        this.readString(source, 'folderId') ??
        this.configService.get('GOOGLE_DRIVE_FOLDER_ID', { infer: true }),
    };
  }

  private buildHeaders(accessToken?: string): HeadersInit {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async parseJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      return {} as T;
    }
  }

  private readString(
    source: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = source[key];

    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private isProduction(): boolean {
    return this.configService.get('NODE_ENV', { infer: true }) === 'production';
  }
}
