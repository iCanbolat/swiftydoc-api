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

interface OneDriveSharePointCredentials {
  accessToken?: string;
  driveId?: string;
  graphBaseUrl: string;
  itemId?: string;
  siteId?: string;
}

interface MicrosoftGraphErrorResponse {
  error?: {
    message?: string;
  };
}

interface MicrosoftGraphDriveResponse {
  driveType?: string;
  id?: string;
  name?: string;
  owner?: {
    user?: {
      displayName?: string;
      email?: string;
    };
  };
  webUrl?: string;
}

interface MicrosoftGraphItemResponse {
  file?: {
    mimeType?: string;
  };
  folder?: {
    childCount?: number;
  };
  id?: string;
  name?: string;
  webUrl?: string;
}

interface MicrosoftGraphUploadResponse
  extends MicrosoftGraphErrorResponse, MicrosoftGraphItemResponse {
  size?: number;
}

@Injectable()
export class OneDriveSharePointIntegrationConnector implements IntegrationConnector {
  readonly providerKey = 'onedrive_sharepoint' as const;

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
          'OneDrive / SharePoint access token is missing for production integration testing.',
        );
      }

      return {
        success: true,
        status: 'connected',
        mode: 'simulated',
        message: 'Simulated OneDrive / SharePoint connection test succeeded.',
        metadata: {
          mode: 'simulated',
          reason: 'missing_credentials',
        },
      };
    }

    const drive = await this.fetchDrive(credentials);
    const item = credentials.itemId ? await this.fetchItem(credentials) : null;

    return {
      success: true,
      status: 'connected',
      mode: 'live',
      message: 'OneDrive / SharePoint connection test succeeded.',
      metadata: {
        driveId: drive.id ?? credentials.driveId ?? null,
        driveName: drive.name ?? null,
        driveType: drive.driveType ?? null,
        driveUrl: drive.webUrl ?? null,
        itemChildCount: item?.folder?.childCount ?? null,
        itemId: item?.id ?? credentials.itemId ?? null,
        itemMimeType: item?.file?.mimeType ?? null,
        itemName: item?.name ?? null,
        itemUrl: item?.webUrl ?? null,
        ownerDisplayName: drive.owner?.user?.displayName ?? null,
        ownerEmail: drive.owner?.user?.email ?? null,
        siteId: credentials.siteId ?? null,
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
      const remoteItem = await this.uploadArtifact(credentials, context);

      return {
        status: 'succeeded',
        mode: 'live',
        message: 'OneDrive / SharePoint export artifact delivery completed.',
        metadata: {
          ...testResult.metadata,
          remoteFileId: remoteItem.id ?? null,
          remoteFileMimeType: remoteItem.file?.mimeType ?? null,
          remoteFileName: remoteItem.name ?? context.artifact.fileName,
          remoteFileUrl: remoteItem.webUrl ?? null,
          syncScope: 'export_artifact',
        },
        externalReference:
          remoteItem.id && context.syncPayload
            ? this.buildExternalReference(
                context,
                remoteItem.id,
                remoteItem.name,
                remoteItem.webUrl,
              )
            : undefined,
      };
    }

    return {
      status: 'succeeded',
      mode: testResult.mode,
      message: 'OneDrive / SharePoint metadata sync completed.',
      metadata: {
        ...testResult.metadata,
        syncScope: credentials.itemId
          ? 'storage_item_profile'
          : 'drive_profile',
      },
    };
  }

  private async fetchDrive(
    credentials: OneDriveSharePointCredentials,
  ): Promise<MicrosoftGraphDriveResponse> {
    const response = await fetch(
      `${credentials.graphBaseUrl.replace(/\/$/, '')}${this.resolveDrivePath(credentials)}`,
      {
        method: 'GET',
        headers: this.buildHeaders(credentials.accessToken),
      },
    );
    const responseBody = await this.parseJson<
      MicrosoftGraphErrorResponse & MicrosoftGraphDriveResponse
    >(response);

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `OneDrive / SharePoint drive lookup failed (${response.status}): ${responseBody.error?.message ?? 'Unknown provider error'}`,
      );
    }

    return responseBody;
  }

  private async fetchItem(
    credentials: OneDriveSharePointCredentials,
  ): Promise<MicrosoftGraphItemResponse> {
    if (!credentials.itemId) {
      throw new ServiceUnavailableException(
        'OneDrive / SharePoint item id is required for item metadata sync.',
      );
    }

    const response = await fetch(
      `${credentials.graphBaseUrl.replace(/\/$/, '')}${this.resolveDrivePath(credentials)}/items/${encodeURIComponent(credentials.itemId)}`,
      {
        method: 'GET',
        headers: this.buildHeaders(credentials.accessToken),
      },
    );
    const responseBody = await this.parseJson<
      MicrosoftGraphErrorResponse & MicrosoftGraphItemResponse
    >(response);

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `OneDrive / SharePoint item lookup failed (${response.status}): ${responseBody.error?.message ?? 'Unknown provider error'}`,
      );
    }

    return responseBody;
  }

  private async uploadArtifact(
    credentials: OneDriveSharePointCredentials,
    context: IntegrationConnectorContext,
  ): Promise<MicrosoftGraphUploadResponse> {
    const artifact = context.artifact;
    const payload = context.syncPayload;

    if (!artifact || !isStorageExportSyncPayload(payload)) {
      throw new ServiceUnavailableException(
        'OneDrive / SharePoint artifact upload requires a storage export payload and artifact body.',
      );
    }

    if (!credentials.accessToken) {
      throw new ServiceUnavailableException(
        'OneDrive / SharePoint access token is required for artifact delivery.',
      );
    }

    const externalId = context.externalReference?.externalId?.trim();
    const drivePath = this.resolveDrivePath(credentials);
    const destinationPath = this.buildDestinationPath(
      payload.destination?.path,
      artifact.fileName,
    );
    const endpoint = externalId
      ? `${credentials.graphBaseUrl.replace(/\/$/, '')}${drivePath}/items/${encodeURIComponent(externalId)}/content`
      : payload.destination?.itemId || credentials.itemId
        ? `${credentials.graphBaseUrl.replace(/\/$/, '')}${drivePath}/items/${encodeURIComponent(payload.destination?.itemId ?? credentials.itemId ?? '')}:/${destinationPath}:/content`
        : `${credentials.graphBaseUrl.replace(/\/$/, '')}${drivePath}/root:/${destinationPath}:/content`;
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': artifact.mimeType,
      },
      body: new Uint8Array(artifact.body),
    });
    const responseBody =
      await this.parseJson<MicrosoftGraphUploadResponse>(response);

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `OneDrive / SharePoint artifact upload failed (${response.status}): ${responseBody.error?.message ?? 'Unknown provider error'}`,
      );
    }

    return responseBody;
  }

  private buildDestinationPath(
    path: string | undefined,
    fileName: string,
  ): string {
    const normalizedPath = path?.trim().replace(/^\/+|\/+$/g, '');
    return normalizedPath ? `${normalizedPath}/${fileName}` : fileName;
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
        'OneDrive / SharePoint external reference requires a storage export payload.',
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

  private resolveDrivePath(credentials: OneDriveSharePointCredentials): string {
    if (credentials.siteId) {
      return `/sites/${encodeURIComponent(credentials.siteId)}/drive`;
    }

    if (credentials.driveId) {
      return `/drives/${encodeURIComponent(credentials.driveId)}`;
    }

    return '/me/drive';
  }

  private resolveCredentials(
    source: Record<string, unknown>,
  ): OneDriveSharePointCredentials {
    return {
      accessToken:
        this.readString(source, 'accessToken') ??
        this.configService.get('ONEDRIVE_SHAREPOINT_ACCESS_TOKEN', {
          infer: true,
        }),
      driveId:
        this.readString(source, 'driveId') ??
        this.configService.get('ONEDRIVE_SHAREPOINT_DRIVE_ID', {
          infer: true,
        }),
      graphBaseUrl:
        this.readString(source, 'graphBaseUrl') ??
        this.configService.get('ONEDRIVE_SHAREPOINT_GRAPH_BASE_URL', {
          infer: true,
        }) ??
        'https://graph.microsoft.com/v1.0',
      itemId:
        this.readString(source, 'itemId') ??
        this.configService.get('ONEDRIVE_SHAREPOINT_ITEM_ID', {
          infer: true,
        }),
      siteId:
        this.readString(source, 'siteId') ??
        this.configService.get('ONEDRIVE_SHAREPOINT_SITE_ID', {
          infer: true,
        }),
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
