import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { WEBHOOK_EVENTS } from '../../common/webhooks/webhook-events';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import type { RetrievedFile } from '../../infrastructure/storage/storage.types';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { WebhookService } from '../../infrastructure/webhooks/webhook.service';

export interface UploadBase64Input {
  contentBase64: string;
  contentType: string;
  fileName: string;
  organizationId?: string;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly storageService: StorageService,
    private readonly webhookService: WebhookService,
  ) {}

  async uploadBase64File(input: UploadBase64Input) {
    if (!input.contentBase64) {
      throw new BadRequestException('contentBase64 is required.');
    }

    const body = Buffer.from(input.contentBase64, 'base64');

    if (body.byteLength === 0) {
      throw new BadRequestException('Decoded file is empty.');
    }

    const storageKey = this.buildStorageKey(
      input.fileName,
      input.organizationId,
    );

    const storedFile = await this.storageService.putObject({
      storageKey,
      body,
      contentType: input.contentType || 'application/octet-stream',
    });

    await this.auditLogService.record({
      category: 'data_access',
      action: AUDIT_ACTIONS.data_access.fileUploaded,
      organizationId: input.organizationId,
      resourceType: RESOURCE_TYPES.documents.fileAsset,
      resourceId: storedFile.storageKey,
      metadata: {
        driver: this.storageService.driver,
        sizeBytes: storedFile.sizeBytes,
        contentType: storedFile.contentType,
      },
    });

    await this.webhookService.emitEvent(
      WEBHOOK_EVENTS.files.uploaded,
      {
        storageKey: storedFile.storageKey,
        contentType: storedFile.contentType,
        sizeBytes: storedFile.sizeBytes,
      },
      input.organizationId,
    );

    return {
      ...storedFile,
      storageDriver: this.storageService.driver,
    };
  }

  createDownloadLink(storageKey: string, baseUrl: string): string {
    const publicUrl = this.storageService.getPublicUrl(storageKey);

    if (publicUrl) {
      return publicUrl;
    }

    return `${baseUrl}/v1/files/download?key=${encodeURIComponent(storageKey)}`;
  }

  async downloadFile(storageKey: string): Promise<{
    file: RetrievedFile | null;
    redirectUrl: string | null;
  }> {
    const publicUrl = this.storageService.getPublicUrl(storageKey);

    if (publicUrl) {
      return {
        redirectUrl: publicUrl,
        file: null,
      };
    }

    const file = await this.storageService.getObject(storageKey);

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    return {
      file,
      redirectUrl: null,
    };
  }

  private buildStorageKey(fileName: string, organizationId?: string): string {
    const safeName = fileName
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 120);

    const datePrefix = new Date().toISOString().slice(0, 10);
    const orgPrefix = organizationId ?? 'local';

    return `${orgPrefix}/${datePrefix}/${randomUUID()}_${safeName || 'file.bin'}`;
  }
}
