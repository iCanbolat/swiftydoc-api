import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import {
  type ExportJobType,
  EXPORT_JOB_TYPE_VALUES,
} from '../../common/exports/export-types';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import {
  exportJobs,
  fileAssets,
  requests,
  submissionItems,
  submissions,
} from '../../infrastructure/database/schema';
import { JobQueueService } from '../../infrastructure/queue/job-queue.service';
import { StorageService } from '../../infrastructure/storage/storage.service';

interface CreateExportJobInput {
  organizationId: string;
  exportType: ExportJobType;
  requestId?: string;
  submissionId?: string;
  requestedByUserId?: string;
  includeFiles?: boolean;
  metadata?: Record<string, unknown>;
}

interface ExportGenerationJobPayload {
  exportJobId: string;
  organizationId: string;
}

interface GeneratedArtifact {
  buffer: Buffer;
  extension: 'zip' | 'pdf' | 'csv';
  mimeType: 'application/zip' | 'application/pdf' | 'text/csv';
}

interface FileAssetExportRow {
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

@Injectable()
export class ExportsService implements OnModuleInit {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly databaseService: DatabaseService,
    private readonly jobQueueService: JobQueueService,
    private readonly storageService: StorageService,
  ) {}

  onModuleInit(): void {
    this.jobQueueService.registerHandler<ExportGenerationJobPayload>(
      'exports.generate',
      async (job) => {
        await this.processExportJob(job.payload);
      },
    );
  }

  async createExportJob(input: CreateExportJobInput) {
    this.assertExportTypeSupported(input.exportType);

    const db = this.getDatabase();
    const now = new Date();
    const exportJobId = randomUUID();
    const metadata = {
      includeFiles: input.includeFiles ?? true,
      ...(input.metadata ?? {}),
    };

    try {
      await db.insert(exportJobs).values({
        id: exportJobId,
        organizationId: input.organizationId,
        requestId: input.requestId,
        submissionId: input.submissionId,
        type: input.exportType,
        status: 'queued',
        requestedByUserId: input.requestedByUserId,
        metadata,
        createdAt: now,
      });
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new BadRequestException(
          'Invalid request/submission/requestedBy reference.',
        );
      }

      throw error;
    }

    const queueJobId = await this.jobQueueService.enqueue<ExportGenerationJobPayload>(
      'exports.generate',
      {
        exportJobId,
        organizationId: input.organizationId,
      },
    );

    await this.auditLogService.record({
      category: 'data_access',
      action: AUDIT_ACTIONS.data_access.exportJobQueued,
      organizationId: input.organizationId,
      actorType: input.requestedByUserId ? 'user' : undefined,
      actorId: input.requestedByUserId,
      resourceType: RESOURCE_TYPES.automation.exportJob,
      resourceId: exportJobId,
      metadata: {
        exportType: input.exportType,
        queueJobId,
        requestId: input.requestId,
        submissionId: input.submissionId,
      },
    });

    return {
      id: exportJobId,
      organizationId: input.organizationId,
      type: input.exportType,
      status: 'queued' as const,
      requestId: input.requestId ?? null,
      submissionId: input.submissionId ?? null,
      queueJobId,
      createdAt: now.toISOString(),
    };
  }

  async getExportJob(exportJobId: string, organizationId: string) {
    const db = this.getDatabase();

    const [exportJob] = await db
      .select()
      .from(exportJobs)
      .where(
        and(
          eq(exportJobs.id, exportJobId),
          eq(exportJobs.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!exportJob) {
      throw new NotFoundException('Export job not found.');
    }

    return exportJob;
  }

  createDownloadLink(storageKey: string, baseUrl: string): string {
    const publicUrl = this.storageService.getPublicUrl(storageKey);

    if (publicUrl) {
      return publicUrl;
    }

    return `${baseUrl}/v1/files/download?key=${encodeURIComponent(storageKey)}`;
  }

  getPublicExportUrl(storageKey: string): string | null {
    return this.storageService.getPublicUrl(storageKey);
  }

  private async processExportJob(payload: ExportGenerationJobPayload) {
    const db = this.getDatabase();

    const [exportJob] = await db
      .select()
      .from(exportJobs)
      .where(
        and(
          eq(exportJobs.id, payload.exportJobId),
          eq(exportJobs.organizationId, payload.organizationId),
        ),
      )
      .limit(1);

    if (!exportJob) {
      return;
    }

    const startedAt = new Date();

    await db
      .update(exportJobs)
      .set({
        status: 'processing',
        startedAt,
        errorMessage: null,
      })
      .where(eq(exportJobs.id, exportJob.id));

    try {
      const artifact = await this.generateArtifact(exportJob);
      const storageKey = this.buildExportStorageKey(
        exportJob.organizationId,
        exportJob.id,
        artifact.extension,
      );

      const storedArtifact = await this.storageService.putObject({
        storageKey,
        body: artifact.buffer,
        contentType: artifact.mimeType,
      });

      const completedAt = new Date();

      await db
        .update(exportJobs)
        .set({
          status: 'completed',
          artifactStorageKey: storedArtifact.storageKey,
          artifactMimeType: storedArtifact.contentType,
          artifactSizeBytes: storedArtifact.sizeBytes,
          completedAt,
          errorMessage: null,
        })
        .where(eq(exportJobs.id, exportJob.id));

      await this.auditLogService.record({
        category: 'data_access',
        action: AUDIT_ACTIONS.data_access.exportJobCompleted,
        organizationId: exportJob.organizationId,
        resourceType: RESOURCE_TYPES.automation.exportJob,
        resourceId: exportJob.id,
        metadata: {
          exportType: exportJob.type,
          storageKey: storedArtifact.storageKey,
          sizeBytes: storedArtifact.sizeBytes,
        },
      });
    } catch (error) {
      const completedAt = new Date();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown export generation error';

      await db
        .update(exportJobs)
        .set({
          status: 'failed',
          completedAt,
          errorMessage,
        })
        .where(eq(exportJobs.id, exportJob.id));

      await this.auditLogService.record({
        category: 'data_access',
        action: AUDIT_ACTIONS.data_access.exportJobFailed,
        organizationId: exportJob.organizationId,
        resourceType: RESOURCE_TYPES.automation.exportJob,
        resourceId: exportJob.id,
        metadata: {
          exportType: exportJob.type,
          errorMessage,
        },
      });

      throw error;
    }
  }

  private async generateArtifact(
    exportJob: typeof exportJobs.$inferSelect,
  ): Promise<GeneratedArtifact> {
    switch (exportJob.type) {
      case 'zip':
        return this.generateZipArtifact(exportJob);
      case 'pdf_summary':
        return this.generatePdfArtifact(exportJob);
      case 'csv_metadata':
        return this.generateCsvArtifact(exportJob);
      default:
        throw new BadRequestException(
          `Unsupported export job type ${exportJob.type}.`,
        );
    }
  }

  private async generateCsvArtifact(
    exportJob: typeof exportJobs.$inferSelect,
  ): Promise<GeneratedArtifact> {
    const fileRows = await this.fetchFileAssetRows(exportJob);
    const csv = this.serializeFileMetadataCsv(fileRows);

    return {
      buffer: Buffer.from(csv, 'utf8'),
      extension: 'csv',
      mimeType: 'text/csv',
    };
  }

  private async generatePdfArtifact(
    exportJob: typeof exportJobs.$inferSelect,
  ): Promise<GeneratedArtifact> {
    const summaryLines = await this.buildSummaryLines(exportJob);
    const buffer = await this.createSummaryPdf(summaryLines);

    return {
      buffer,
      extension: 'pdf',
      mimeType: 'application/pdf',
    };
  }

  private async generateZipArtifact(
    exportJob: typeof exportJobs.$inferSelect,
  ): Promise<GeneratedArtifact> {
    const zip = new JSZip();
    const csvArtifact = await this.generateCsvArtifact(exportJob);
    const pdfArtifact = await this.generatePdfArtifact(exportJob);

    zip.file('metadata.csv', csvArtifact.buffer);
    zip.file('summary.pdf', pdfArtifact.buffer);

    if (this.shouldIncludeFiles(exportJob.metadata)) {
      const fileRows = await this.fetchFileAssetRows(exportJob);
      const usedNames = new Set<string>();

      for (const fileRow of fileRows) {
        const fileObject = await this.storageService.getObject(fileRow.storageKey);

        if (!fileObject) {
          continue;
        }

        const baseName = this.sanitizeZipEntryName(
          `${fileRow.fileId}_${fileRow.normalizedFileName}`,
        );
        const uniqueName = this.resolveUniqueZipEntryName(baseName, usedNames);

        zip.file(`files/${uniqueName}`, fileObject.body);
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    return {
      buffer: Buffer.from(zipBuffer),
      extension: 'zip',
      mimeType: 'application/zip',
    };
  }

  private async fetchFileAssetRows(
    exportJob: typeof exportJobs.$inferSelect,
  ): Promise<FileAssetExportRow[]> {
    const db = this.getDatabase();
    const whereConditions = [
      eq(fileAssets.organizationId, exportJob.organizationId),
      eq(fileAssets.status, 'active'),
    ];

    if (exportJob.requestId) {
      whereConditions.push(eq(fileAssets.requestId, exportJob.requestId));
    }

    if (exportJob.submissionId) {
      whereConditions.push(eq(fileAssets.submissionId, exportJob.submissionId));
    }

    return db
      .select({
        fileId: fileAssets.id,
        requestId: fileAssets.requestId,
        submissionId: fileAssets.submissionId,
        submissionItemId: fileAssets.submissionItemId,
        originalFileName: fileAssets.originalFileName,
        normalizedFileName: fileAssets.normalizedFileName,
        detectedMimeType: fileAssets.detectedMimeType,
        sizeBytes: fileAssets.sizeBytes,
        checksumSha256: fileAssets.checksumSha256,
        storageKey: fileAssets.storageKey,
        createdAt: fileAssets.createdAt,
      })
      .from(fileAssets)
      .where(and(...whereConditions))
      .orderBy(asc(fileAssets.createdAt));
  }

  private async buildSummaryLines(exportJob: typeof exportJobs.$inferSelect) {
    const requestScope = await this.resolveRequestScope(exportJob);
    const fileRows = await this.fetchFileAssetRows(exportJob);

    const lines = [
      'SwiftyDoc Export Summary',
      `Export Job ID: ${exportJob.id}`,
      `Organization ID: ${exportJob.organizationId}`,
      `Export Type: ${exportJob.type}`,
      `Created At: ${exportJob.createdAt.toISOString()}`,
      '',
    ];

    if (!requestScope) {
      lines.push('Request Scope: none');
      lines.push(`Files Included: ${fileRows.length}`);
      return lines;
    }

    const db = this.getDatabase();
    const [requestRow] = await db
      .select({
        id: requests.id,
        requestCode: requests.requestCode,
        title: requests.title,
        status: requests.status,
        dueAt: requests.dueAt,
      })
      .from(requests)
      .where(
        and(
          eq(requests.id, requestScope),
          eq(requests.organizationId, exportJob.organizationId),
        ),
      )
      .limit(1);

    if (!requestRow) {
      lines.push(`Request Scope: ${requestScope} (not found)`);
      lines.push(`Files Included: ${fileRows.length}`);
      return lines;
    }

    const [submissionCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(submissions)
      .where(eq(submissions.requestId, requestRow.id));

    const [completedSubmissionCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(submissions)
      .where(
        and(
          eq(submissions.requestId, requestRow.id),
          eq(submissions.status, 'completed'),
        ),
      );

    const [approvedItemsCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(submissionItems)
      .innerJoin(submissions, eq(submissions.id, submissionItems.submissionId))
      .where(
        and(
          eq(submissions.requestId, requestRow.id),
          eq(submissionItems.status, 'approved'),
        ),
      );

    const [rejectedItemsCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(submissionItems)
      .innerJoin(submissions, eq(submissions.id, submissionItems.submissionId))
      .where(
        and(
          eq(submissions.requestId, requestRow.id),
          eq(submissionItems.status, 'rejected'),
        ),
      );

    lines.push(`Request ID: ${requestRow.id}`);
    lines.push(`Request Code: ${requestRow.requestCode}`);
    lines.push(`Title: ${requestRow.title}`);
    lines.push(`Status: ${requestRow.status}`);
    lines.push(
      `Due At: ${requestRow.dueAt ? requestRow.dueAt.toISOString() : 'not set'}`,
    );
    lines.push(
      `Submissions: ${Number(submissionCountRow?.count ?? 0)} total / ${Number(completedSubmissionCountRow?.count ?? 0)} completed`,
    );
    lines.push(`Approved Items: ${Number(approvedItemsCountRow?.count ?? 0)}`);
    lines.push(`Rejected Items: ${Number(rejectedItemsCountRow?.count ?? 0)}`);
    lines.push(`Files Included: ${fileRows.length}`);

    return lines;
  }

  private async createSummaryPdf(lines: string[]): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let page = pdfDoc.addPage([595.28, 841.89]);
    let cursorY = 800;

    for (const line of lines) {
      if (cursorY < 40) {
        page = pdfDoc.addPage([595.28, 841.89]);
        cursorY = 800;
      }

      page.drawText(line, {
        x: 40,
        y: cursorY,
        size: 11,
        font,
      });

      cursorY -= 16;
    }

    const pdfBytes = await pdfDoc.save();

    return Buffer.from(pdfBytes);
  }

  private serializeFileMetadataCsv(rows: FileAssetExportRow[]): string {
    const headers = [
      'file_id',
      'request_id',
      'submission_id',
      'submission_item_id',
      'original_file_name',
      'normalized_file_name',
      'detected_mime_type',
      'size_bytes',
      'checksum_sha256',
      'storage_key',
      'created_at',
    ];

    const dataLines = rows.map((row) =>
      [
        row.fileId,
        row.requestId,
        row.submissionId,
        row.submissionItemId,
        row.originalFileName,
        row.normalizedFileName,
        row.detectedMimeType,
        row.sizeBytes,
        row.checksumSha256,
        row.storageKey,
        row.createdAt.toISOString(),
      ]
        .map((value) => this.escapeCsvCell(value))
        .join(','),
    );

    return [headers.join(','), ...dataLines].join('\n');
  }

  private escapeCsvCell(value: unknown): string {
    const normalized = value === null || value === undefined ? '' : String(value);

    if (
      normalized.includes(',') ||
      normalized.includes('"') ||
      normalized.includes('\n') ||
      normalized.includes('\r')
    ) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }

    return normalized;
  }

  private async resolveRequestScope(
    exportJob: typeof exportJobs.$inferSelect,
  ): Promise<string | null> {
    if (exportJob.requestId) {
      return exportJob.requestId;
    }

    if (!exportJob.submissionId) {
      return null;
    }

    const db = this.getDatabase();
    const [submissionRow] = await db
      .select({ requestId: submissions.requestId })
      .from(submissions)
      .where(
        and(
          eq(submissions.id, exportJob.submissionId),
          eq(submissions.organizationId, exportJob.organizationId),
        ),
      )
      .limit(1);

    return submissionRow?.requestId ?? null;
  }

  private shouldIncludeFiles(metadata: Record<string, unknown>): boolean {
    const includeFiles = metadata.includeFiles;

    if (typeof includeFiles === 'boolean') {
      return includeFiles;
    }

    return true;
  }

  private sanitizeZipEntryName(fileName: string): string {
    const sanitized = fileName
      .replace(/\s+/g, '_')
      .replace(/[\\/]/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 180);

    return sanitized || 'file.bin';
  }

  private resolveUniqueZipEntryName(
    baseName: string,
    usedNames: Set<string>,
  ): string {
    let candidate = baseName;
    let suffix = 1;

    while (usedNames.has(candidate)) {
      const dotIndex = baseName.lastIndexOf('.');

      if (dotIndex > 0) {
        const name = baseName.slice(0, dotIndex);
        const extension = baseName.slice(dotIndex);
        candidate = `${name}_${suffix}${extension}`;
      } else {
        candidate = `${baseName}_${suffix}`;
      }

      suffix += 1;
    }

    usedNames.add(candidate);

    return candidate;
  }

  private buildExportStorageKey(
    organizationId: string,
    exportJobId: string,
    extension: 'zip' | 'pdf' | 'csv',
  ): string {
    const datePrefix = new Date().toISOString().slice(0, 10);

    return `${organizationId}/exports/${datePrefix}/${exportJobId}.${extension}`;
  }

  private assertExportTypeSupported(type: string): void {
    if (!EXPORT_JOB_TYPE_VALUES.includes(type as ExportJobType)) {
      throw new BadRequestException(`Unsupported export type ${type}.`);
    }
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for export workflow operations.',
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
}
