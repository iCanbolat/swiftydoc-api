import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { AuditLogService } from '../audit/audit-log.service';
import type { QueueHandler, QueueJob } from './job-queue.types';

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);
  private readonly handlers = new Map<string, QueueHandler>();
  private readonly pendingJobs: QueueJob[] = [];
  private isProcessing = false;

  constructor(private readonly auditLogService: AuditLogService) {}

  registerHandler<TPayload = unknown>(
    type: string,
    handler: QueueHandler<TPayload>,
  ): void {
    this.handlers.set(type, handler as QueueHandler);
  }

  async enqueue<TPayload = unknown>(
    type: string,
    payload: TPayload,
    maxAttempts = 3,
  ): Promise<string> {
    const job: QueueJob<TPayload> = {
      id: randomUUID(),
      type,
      payload,
      attempt: 0,
      maxAttempts,
      enqueuedAt: new Date(),
    };

    this.pendingJobs.push(job as QueueJob);
    void this.processQueue();

    await this.auditLogService.record({
      category: 'queue',
      action: AUDIT_ACTIONS.queue.jobEnqueued,
      resourceType: RESOURCE_TYPES.automation.queueJob,
      resourceId: job.id,
      metadata: {
        type,
        maxAttempts,
      },
    });

    return job.id;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.pendingJobs.length > 0) {
      const job = this.pendingJobs.shift();

      if (!job) {
        break;
      }

      await this.runJob(job);
    }

    this.isProcessing = false;
  }

  private async runJob(job: QueueJob): Promise<void> {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      this.logger.warn(
        `No handler registered for queue job type "${job.type}".`,
      );
      await this.auditLogService.record({
        category: 'queue',
        action: AUDIT_ACTIONS.queue.jobSkippedNoHandler,
        resourceType: RESOURCE_TYPES.automation.queueJob,
        resourceId: job.id,
        metadata: {
          type: job.type,
        },
      });
      return;
    }

    try {
      await handler(job);
      await this.auditLogService.record({
        category: 'queue',
        action: AUDIT_ACTIONS.queue.jobSucceeded,
        resourceType: RESOURCE_TYPES.automation.queueJob,
        resourceId: job.id,
        metadata: {
          type: job.type,
          attempt: job.attempt,
        },
      });
    } catch (error) {
      const nextAttempt = job.attempt + 1;

      if (nextAttempt < job.maxAttempts) {
        this.pendingJobs.push({
          ...job,
          attempt: nextAttempt,
        });

        await this.auditLogService.record({
          category: 'queue',
          action: AUDIT_ACTIONS.queue.jobRequeued,
          resourceType: RESOURCE_TYPES.automation.queueJob,
          resourceId: job.id,
          metadata: {
            type: job.type,
            attempt: nextAttempt,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown queue handler error',
          },
        });
      } else {
        this.logger.error(
          `Queue job ${job.id} failed permanently after ${job.maxAttempts} attempts.`,
          error instanceof Error ? error.stack : undefined,
        );

        await this.auditLogService.record({
          category: 'queue',
          action: AUDIT_ACTIONS.queue.jobFailed,
          resourceType: RESOURCE_TYPES.automation.queueJob,
          resourceId: job.id,
          metadata: {
            type: job.type,
            attempt: nextAttempt,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown queue handler error',
          },
        });
      }
    }
  }
}
