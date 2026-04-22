import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { auditEvents } from '../database/schema';
import type { AuditLogEntry } from './audit.types';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async record(entry: AuditLogEntry): Promise<void> {
    const eventId = randomUUID();

    this.logger.log(
      JSON.stringify({
        auditId: eventId,
        category: entry.category,
        action: entry.action,
        channel: entry.channel ?? null,
        organizationId: entry.organizationId ?? null,
      }),
    );

    if (!this.databaseService.isConfigured()) {
      return;
    }

    try {
      await this.databaseService.db.insert(auditEvents).values({
        id: eventId,
        organizationId: entry.organizationId,
        category: entry.category,
        channel: entry.channel,
        action: entry.action,
        actorType: entry.actorType,
        actorId: entry.actorId,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata ?? {},
      });
    } catch (error) {
      this.logger.error(
        'Failed to persist audit event.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
