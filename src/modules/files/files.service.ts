import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fromBuffer } from 'file-type';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { WEBHOOK_EVENTS } from '../../common/webhooks/webhook-events';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { fileAssets } from '../../infrastructure/database/schema';
import type { RetrievedFile } from '../../infrastructure/storage/storage.types';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { WebhookService } from '../../infrastructure/webhooks/webhook.service';

const DEFAULT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/plain',
];

const ZIP_CONTAINER_DECLARED_MIME_TYPES = new Set([
  'application/zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/csv': 'csv',
  'text/plain': 'txt',
};

type UploadedByType = 'user' | 'recipient' | 'system';

export interface UploadBase64Input {
  contentBase64: string;
  contentType?: string;
  fileName: string;
  organizationId: string;
  requestId?: string;
  submissionId?: string;
  submissionItemId?: string;
  uploadedByType?: UploadedByType;
  uploadedById?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class FilesService {
  private readonly allowedMimeTypes: ReadonlySet<string>;
  private readonly maxUploadBytes: number;

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService<RuntimeEnv, true>,
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly webhookService: WebhookService,
  ) {
    this.maxUploadBytes = this.configService.get('FILE_UPLOAD_MAX_BYTES', {
      infer: true,
    });

    this.allowedMimeTypes = this.parseAllowedMimeTypes(
      this.configService.get('FILE_UPLOAD_ALLOWED_MIME_TYPES', {
        infer: true,
      }),
    );
  }

  async uploadBase64File(input: UploadBase64Input) {
    if (!input.organizationId?.trim()) {
      throw new BadRequestException('organizationId is required.');
    }

    if (!input.contentBase64) {
      throw new BadRequestException('contentBase64 is required.');
    }

    const body = Buffer.from(input.contentBase64, 'base64');

    if (body.byteLength === 0) {
      throw new BadRequestException('Decoded file is empty.');
    }

    if (body.byteLength > this.maxUploadBytes) {
      throw new PayloadTooLargeException(
        `File exceeds max allowed size of ${this.maxUploadBytes} bytes.`,
      );
    }

    const declaredMimeType = input.contentType?.trim().toLowerCase() || null;
    const { detectedMimeType, effectiveMimeType } = await this.resolveMimeType({
      body,
      declaredMimeType,
    });

    const normalizedFileName = this.normalizeFileName(
      input.fileName,
      effectiveMimeType,
    );

    const storageKey = this.buildStorageKey(
      normalizedFileName,
      input.organizationId,
    );

    const checksumSha256 = createHash('sha256').update(body).digest('hex');

    const storedFile = await this.storageService.putObject({
      storageKey,
      body,
      contentType: effectiveMimeType,
    });

    let fileAsset: {
      id: string;
      requestId: string | null;
      submissionId: string | null;
      submissionItemId: string | null;
    };

    try {
      fileAsset = await this.persistFileMetadata({
        organizationId: input.organizationId,
        requestId: input.requestId,
        submissionId: input.submissionId,
        submissionItemId: input.submissionItemId,
        storageKey: storedFile.storageKey,
        originalFileName: input.fileName,
        normalizedFileName,
        declaredMimeType,
        detectedMimeType,
        sizeBytes: storedFile.sizeBytes,
        checksumSha256,
        uploadedByType: input.uploadedByType ?? 'system',
        uploadedById: input.uploadedById,
        metadata: input.metadata ?? {},
      });
    } catch (error) {
      await this.safeDeleteStoredObject(storedFile.storageKey);
      throw error;
    }

    await this.auditLogService.record({
      category: 'data_access',
      action: AUDIT_ACTIONS.data_access.fileUploaded,
      organizationId: input.organizationId,
      resourceType: RESOURCE_TYPES.documents.fileAsset,
      resourceId: fileAsset.id,
      metadata: {
        fileId: fileAsset.id,
        driver: this.storageService.driver,
        detectedMimeType,
        declaredMimeType,
        normalizedFileName,
        sizeBytes: storedFile.sizeBytes,
        contentType: effectiveMimeType,
        submissionItemId: input.submissionItemId,
      },
    });

    await this.webhookService.emitEvent(
      WEBHOOK_EVENTS.files.uploaded,
      {
        fileId: fileAsset.id,
        requestId: fileAsset.requestId,
        submissionId: fileAsset.submissionId,
        submissionItemId: fileAsset.submissionItemId,
        storageKey: storedFile.storageKey,
        contentType: effectiveMimeType,
        sizeBytes: storedFile.sizeBytes,
      },
      input.organizationId,
    );

    return {
      fileId: fileAsset.id,
      originalFileName: input.fileName,
      normalizedFileName,
      declaredMimeType,
      detectedMimeType,
      checksumSha256,
      ...storedFile,
      storageDriver: this.storageService.driver,
    };
  }

  async getFileMetadata(fileId: string) {
    const db = this.getDatabase();
    const [fileAsset] = await db
      .select()
      .from(fileAssets)
      .where(eq(fileAssets.id, fileId))
      .limit(1);

    if (!fileAsset || fileAsset.status === 'deleted') {
      throw new NotFoundException('File metadata not found.');
    }

    return fileAsset;
  }

  createDownloadLink(storageKey: string, baseUrl: string): string {
    const publicUrl = this.storageService.getPublicUrl(storageKey);

    if (publicUrl) {
      return publicUrl;
    }

    return `${baseUrl}/v1/files/download?key=${encodeURIComponent(storageKey)}`;
  }

  getPublicFileUrl(storageKey: string): string | null {
    return this.storageService.getPublicUrl(storageKey);
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

    if (file.contentType) {
      return {
        file,
        redirectUrl: null,
      };
    }

    const fileAsset = await this.findFileByStorageKey(storageKey);

    return {
      file: {
        ...file,
        contentType: fileAsset?.detectedMimeType ?? null,
      },
      redirectUrl: null,
    };
  }

  private async resolveMimeType(input: {
    body: Buffer;
    declaredMimeType: string | null;
  }): Promise<{ detectedMimeType: string; effectiveMimeType: string }> {
    const detected = await fromBuffer(input.body);
    const detectedMimeType = detected?.mime?.toLowerCase() ?? null;

    if (
      detectedMimeType &&
      input.declaredMimeType &&
      detectedMimeType !== input.declaredMimeType
    ) {
      const isZipContainerCompat =
        detectedMimeType === 'application/zip' &&
        ZIP_CONTAINER_DECLARED_MIME_TYPES.has(input.declaredMimeType);

      if (!isZipContainerCompat) {
        throw new BadRequestException(
          `Declared MIME ${input.declaredMimeType} does not match detected MIME ${detectedMimeType}.`,
        );
      }
    }

    const effectiveMimeType =
      detectedMimeType === 'application/zip' &&
      input.declaredMimeType &&
      ZIP_CONTAINER_DECLARED_MIME_TYPES.has(input.declaredMimeType)
        ? input.declaredMimeType
        : (detectedMimeType ?? input.declaredMimeType);

    if (!effectiveMimeType) {
      throw new BadRequestException(
        'Unable to determine MIME type. Provide a valid contentType.',
      );
    }

    if (!this.allowedMimeTypes.has(effectiveMimeType)) {
      throw new BadRequestException(
        `Unsupported MIME type ${effectiveMimeType}.`,
      );
    }

    return {
      detectedMimeType: detectedMimeType ?? effectiveMimeType,
      effectiveMimeType,
    };
  }

  private async persistFileMetadata(input: {
    organizationId: string;
    requestId?: string;
    submissionId?: string;
    submissionItemId?: string;
    storageKey: string;
    originalFileName: string;
    normalizedFileName: string;
    declaredMimeType: string | null;
    detectedMimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    uploadedByType: UploadedByType;
    uploadedById?: string;
    metadata: Record<string, unknown>;
  }) {
    const db = this.getDatabase();
    const fileId = randomUUID();
    const extension = this.resolveExtension(input.normalizedFileName);

    try {
      await db.insert(fileAssets).values({
        id: fileId,
        organizationId: input.organizationId,
        requestId: input.requestId,
        submissionId: input.submissionId,
        submissionItemId: input.submissionItemId,
        storageKey: input.storageKey,
        storageDriver: this.storageService.driver,
        originalFileName: input.originalFileName,
        normalizedFileName: input.normalizedFileName,
        extension,
        declaredMimeType: input.declaredMimeType,
        detectedMimeType: input.detectedMimeType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
        status: 'active',
        uploadedByType: input.uploadedByType,
        uploadedById: input.uploadedById,
        metadata: input.metadata,
      });
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new BadRequestException(
          'Invalid request/submission/submission item reference.',
        );
      }

      throw error;
    }

    return {
      id: fileId,
      requestId: input.requestId ?? null,
      submissionId: input.submissionId ?? null,
      submissionItemId: input.submissionItemId ?? null,
    };
  }

  private async findFileByStorageKey(storageKey: string) {
    if (!this.databaseService.isConfigured()) {
      return null;
    }

    const [fileAsset] = await this.databaseService.db
      .select({
        detectedMimeType: fileAssets.detectedMimeType,
      })
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.storageKey, storageKey),
          eq(fileAssets.status, 'active'),
        ),
      )
      .limit(1);

    return fileAsset ?? null;
  }

  private buildStorageKey(fileName: string, organizationId: string): string {
    const safeName = fileName
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 120);

    const datePrefix = new Date().toISOString().slice(0, 10);

    return `${organizationId}/${datePrefix}/${randomUUID()}_${safeName || 'file.bin'}`;
  }

  private normalizeFileName(fileName: string, mimeType: string): string {
    const base = fileName
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 200);

    if (!base) {
      return `file.${MIME_EXTENSION_MAP[mimeType] ?? 'bin'}`;
    }

    if (path.extname(base)) {
      return base;
    }

    const extension = MIME_EXTENSION_MAP[mimeType] ?? 'bin';

    return `${base}.${extension}`;
  }

  private resolveExtension(fileName: string): string | null {
    const extension = path.extname(fileName).replace('.', '').toLowerCase();

    return extension || null;
  }

  private parseAllowedMimeTypes(rawValue: string): ReadonlySet<string> {
    const parsed = rawValue
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);

    return new Set(parsed.length > 0 ? parsed : DEFAULT_ALLOWED_MIME_TYPES);
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for file metadata persistence.',
      );
    }

    return this.databaseService.db;
  }

  private isForeignKeyViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    return (
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === '23503'
    );
  }

  private async safeDeleteStoredObject(storageKey: string): Promise<void> {
    try {
      await this.storageService.deleteObject(storageKey);
    } catch {
      // Best-effort cleanup; original persistence error is more actionable.
    }
  }
}
