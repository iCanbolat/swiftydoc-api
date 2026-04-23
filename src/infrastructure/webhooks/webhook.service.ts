import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import type { WebhookDeliveryStatus } from '../../common/webhooks/webhook-delivery-types';
import type {
  WebhookEventType,
  WebhookSubscriptionType,
} from '../../common/webhooks/webhook-events';
import { AuditLogService } from '../audit/audit-log.service';
import { DatabaseService } from '../database/database.service';
import { webhookDeliveries, webhookEndpoints } from '../database/schema';
import { JobQueueService } from '../queue/job-queue.service';
import type {
  WebhookDeliveryJobPayload,
  WebhookDeliveryRecord,
  WebhookEndpointRecord,
} from './webhook.types';

@Injectable()
export class WebhookService implements OnModuleInit {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService<RuntimeEnv, true>,
    private readonly databaseService: DatabaseService,
    private readonly jobQueueService: JobQueueService,
  ) {}

  onModuleInit(): void {
    this.jobQueueService.registerHandler<WebhookDeliveryJobPayload>(
      'webhook.deliver',
      async (job) => {
        await this.deliverWebhook(job.payload);
      },
    );
  }

  async registerEndpoint(input: {
    actorUserId?: string;
    organizationId: string;
    secret: string;
    subscribedEvents: WebhookSubscriptionType[];
    url: string;
  }): Promise<WebhookEndpointRecord> {
    const db = this.getDatabase();
    const now = new Date();
    const [endpoint] = await db
      .insert(webhookEndpoints)
      .values({
        id: randomUUID(),
        organizationId: input.organizationId,
        url: input.url,
        secret: input.secret,
        subscribedEvents:
          input.subscribedEvents.length > 0 ? input.subscribedEvents : ['*'],
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const mappedEndpoint = this.mapEndpointRecord(endpoint);

    await this.auditLogService.record({
      category: 'webhook',
      action: AUDIT_ACTIONS.webhook.endpointRegistered,
      organizationId: mappedEndpoint.organizationId,
      actorId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.automation.webhookEndpoint,
      resourceId: mappedEndpoint.id,
      metadata: {
        url: mappedEndpoint.url,
        subscribedEvents: mappedEndpoint.subscribedEvents,
      },
    });

    return mappedEndpoint;
  }

  async listEndpoints(
    organizationId: string,
  ): Promise<WebhookEndpointRecord[]> {
    const db = this.getDatabase();
    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.organizationId, organizationId))
      .orderBy(desc(webhookEndpoints.createdAt));

    return endpoints.map((endpoint) => this.mapEndpointRecord(endpoint));
  }

  async listDeliveries(input: {
    organizationId: string;
    endpointId?: string;
    status?: WebhookDeliveryStatus;
  }): Promise<WebhookDeliveryRecord[]> {
    const db = this.getDatabase();
    const conditions = [
      eq(webhookDeliveries.organizationId, input.organizationId),
    ];

    if (input.endpointId) {
      conditions.push(eq(webhookDeliveries.endpointId, input.endpointId));
    }

    if (input.status) {
      conditions.push(eq(webhookDeliveries.status, input.status));
    }

    const deliveries = await db
      .select({
        id: webhookDeliveries.id,
        organizationId: webhookDeliveries.organizationId,
        endpointId: webhookDeliveries.endpointId,
        endpointUrl: webhookEndpoints.url,
        eventId: webhookDeliveries.eventId,
        eventType: webhookDeliveries.eventType,
        requestBody: webhookDeliveries.requestBody,
        status: webhookDeliveries.status,
        attemptCount: webhookDeliveries.attemptCount,
        responseCode: webhookDeliveries.responseCode,
        lastErrorMessage: webhookDeliveries.lastErrorMessage,
        sourceDeliveryId: webhookDeliveries.sourceDeliveryId,
        lastAttemptedAt: webhookDeliveries.lastAttemptedAt,
        deliveredAt: webhookDeliveries.deliveredAt,
        createdAt: webhookDeliveries.createdAt,
        updatedAt: webhookDeliveries.updatedAt,
      })
      .from(webhookDeliveries)
      .innerJoin(
        webhookEndpoints,
        eq(webhookEndpoints.id, webhookDeliveries.endpointId),
      )
      .where(and(...conditions))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(100);

    return deliveries.map((delivery) => this.mapDeliveryRecord(delivery));
  }

  async replayDelivery(
    deliveryId: string,
    input: { organizationId: string; actorUserId?: string },
  ): Promise<WebhookDeliveryRecord> {
    const originalDelivery = await this.getDeliveryOrThrow(
      deliveryId,
      input.organizationId,
    );
    const db = this.getDatabase();
    const replayedAt = new Date();
    const [replayedDelivery] = await db
      .insert(webhookDeliveries)
      .values({
        id: randomUUID(),
        organizationId: originalDelivery.organizationId,
        endpointId: originalDelivery.endpointId,
        eventId: originalDelivery.eventId,
        eventType: originalDelivery.eventType,
        requestBody: originalDelivery.requestBody,
        status: 'queued',
        attemptCount: 0,
        responseCode: null,
        lastErrorMessage: null,
        sourceDeliveryId: originalDelivery.id,
        createdAt: replayedAt,
        updatedAt: replayedAt,
      })
      .returning();
    const mappedDelivery = this.mapDeliveryRecord({
      ...replayedDelivery,
      endpointUrl: originalDelivery.endpointUrl,
    });

    await this.jobQueueService.enqueue('webhook.deliver', {
      deliveryId: mappedDelivery.id,
    });

    await this.auditLogService.record({
      category: 'webhook',
      action: AUDIT_ACTIONS.webhook.deliveryReplayed,
      organizationId: mappedDelivery.organizationId,
      actorId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.automation.webhookDelivery,
      resourceId: mappedDelivery.id,
      metadata: {
        endpointId: mappedDelivery.endpointId,
        sourceDeliveryId: originalDelivery.id,
        eventType: mappedDelivery.eventType,
      },
    });

    return mappedDelivery;
  }

  sanitizeEndpoint(endpoint: WebhookEndpointRecord) {
    return {
      ...endpoint,
      secret: '[redacted]',
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString(),
    };
  }

  serializeDelivery(delivery: WebhookDeliveryRecord) {
    return {
      ...delivery,
      lastAttemptedAt: delivery.lastAttemptedAt?.toISOString() ?? null,
      deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
      updatedAt: delivery.updatedAt.toISOString(),
    };
  }

  async emitEvent(
    eventType: WebhookEventType,
    data: Record<string, unknown>,
    organizationId?: string,
    actorUserId?: string,
  ): Promise<{ deliveredTo: number; eventId: string }> {
    const db = this.getDatabase();
    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();
    const event = {
      id: eventId,
      type: eventType,
      occurred_at: occurredAt,
      organization_id: organizationId,
      data,
    };
    const matchingEndpoints = await this.findMatchingEndpoints(
      eventType,
      organizationId,
    );

    for (const endpoint of matchingEndpoints) {
      const now = new Date();
      const [delivery] = await db
        .insert(webhookDeliveries)
        .values({
          id: randomUUID(),
          organizationId: endpoint.organizationId,
          endpointId: endpoint.id,
          eventId,
          eventType,
          requestBody: event,
          status: 'queued',
          attemptCount: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await this.jobQueueService.enqueue('webhook.deliver', {
        deliveryId: delivery.id,
      });
    }

    await this.auditLogService.record({
      category: 'webhook',
      action: AUDIT_ACTIONS.webhook.eventEmitted,
      organizationId,
      actorId: actorUserId,
      actorType: actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.automation.webhookEvent,
      resourceId: eventId,
      metadata: {
        eventType,
        targetCount: matchingEndpoints.length,
      },
    });

    return {
      eventId,
      deliveredTo: matchingEndpoints.length,
    };
  }

  private async deliverWebhook(
    payload: WebhookDeliveryJobPayload,
  ): Promise<void> {
    const delivery = await this.getDeliveryById(payload.deliveryId);

    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found.');
    }

    const endpoint = await this.getEndpointById(delivery.endpointId);

    if (!endpoint || !endpoint.enabled) {
      throw new NotFoundException('Webhook endpoint not found.');
    }

    const requestBody = JSON.stringify(delivery.requestBody);
    const timestamp = new Date().toISOString();
    const signature = this.generateSignature(
      endpoint.secret,
      timestamp,
      requestBody,
    );
    const controller = new AbortController();
    const timeoutMs = this.configService.get('WEBHOOK_DELIVERY_TIMEOUT_MS', {
      infer: true,
    });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const attemptedAt = new Date();
    const db = this.getDatabase();

    await db
      .update(webhookDeliveries)
      .set({
        attemptCount: delivery.attemptCount + 1,
        lastAttemptedAt: attemptedAt,
        updatedAt: attemptedAt,
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SwiftyDoc-Delivery-Id': delivery.id,
          'X-SwiftyDoc-Event': delivery.eventType,
          'X-SwiftyDoc-Signature': signature,
          'X-SwiftyDoc-Timestamp': timestamp,
        },
        body: requestBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Webhook delivery failed with status ${response.status}.`,
        );
      }

      const deliveredAt = new Date();
      await db
        .update(webhookDeliveries)
        .set({
          status: 'delivered',
          responseCode: response.status,
          lastErrorMessage: null,
          deliveredAt,
          updatedAt: deliveredAt,
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      await this.auditLogService.record({
        category: 'webhook',
        action: AUDIT_ACTIONS.webhook.deliverySucceeded,
        organizationId: delivery.organizationId,
        resourceType: RESOURCE_TYPES.automation.webhookDelivery,
        resourceId: delivery.id,
        metadata: {
          endpointId: endpoint.id,
          eventType: delivery.eventType,
        },
      });
    } catch (error) {
      const failedAt = new Date();
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown webhook delivery error';
      const responseCode = this.extractResponseCode(errorMessage);

      await db
        .update(webhookDeliveries)
        .set({
          status: 'failed',
          responseCode,
          lastErrorMessage: errorMessage,
          updatedAt: failedAt,
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      await this.auditLogService.record({
        category: 'webhook',
        action: AUDIT_ACTIONS.webhook.deliveryFailed,
        organizationId: delivery.organizationId,
        resourceType: RESOURCE_TYPES.automation.webhookDelivery,
        resourceId: delivery.id,
        metadata: {
          endpointId: endpoint.id,
          eventType: delivery.eventType,
          error: errorMessage,
        },
      });

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async findMatchingEndpoints(
    eventType: WebhookEventType,
    organizationId?: string,
  ): Promise<WebhookEndpointRecord[]> {
    const db = this.getDatabase();
    const endpoints = organizationId
      ? await db
          .select()
          .from(webhookEndpoints)
          .where(
            and(
              eq(webhookEndpoints.organizationId, organizationId),
              eq(webhookEndpoints.enabled, true),
            ),
          )
      : await db
          .select()
          .from(webhookEndpoints)
          .where(eq(webhookEndpoints.enabled, true));

    return endpoints
      .map((endpoint) => this.mapEndpointRecord(endpoint))
      .filter(
        (endpoint) =>
          endpoint.subscribedEvents.includes('*') ||
          endpoint.subscribedEvents.includes(eventType),
      );
  }

  private async getDeliveryOrThrow(
    deliveryId: string,
    organizationId: string,
  ): Promise<WebhookDeliveryRecord> {
    const delivery = await this.getDeliveryById(deliveryId);

    if (!delivery || delivery.organizationId !== organizationId) {
      throw new NotFoundException('Webhook delivery not found.');
    }

    return delivery;
  }

  private async getDeliveryById(
    deliveryId: string,
  ): Promise<WebhookDeliveryRecord | null> {
    const db = this.getDatabase();
    const [delivery] = await db
      .select({
        id: webhookDeliveries.id,
        organizationId: webhookDeliveries.organizationId,
        endpointId: webhookDeliveries.endpointId,
        endpointUrl: webhookEndpoints.url,
        eventId: webhookDeliveries.eventId,
        eventType: webhookDeliveries.eventType,
        requestBody: webhookDeliveries.requestBody,
        status: webhookDeliveries.status,
        attemptCount: webhookDeliveries.attemptCount,
        responseCode: webhookDeliveries.responseCode,
        lastErrorMessage: webhookDeliveries.lastErrorMessage,
        sourceDeliveryId: webhookDeliveries.sourceDeliveryId,
        lastAttemptedAt: webhookDeliveries.lastAttemptedAt,
        deliveredAt: webhookDeliveries.deliveredAt,
        createdAt: webhookDeliveries.createdAt,
        updatedAt: webhookDeliveries.updatedAt,
      })
      .from(webhookDeliveries)
      .innerJoin(
        webhookEndpoints,
        eq(webhookEndpoints.id, webhookDeliveries.endpointId),
      )
      .where(eq(webhookDeliveries.id, deliveryId))
      .limit(1);

    return delivery ? this.mapDeliveryRecord(delivery) : null;
  }

  private async getEndpointById(
    endpointId: string,
  ): Promise<WebhookEndpointRecord | null> {
    const db = this.getDatabase();
    const [endpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, endpointId))
      .limit(1);

    return endpoint ? this.mapEndpointRecord(endpoint) : null;
  }

  private mapEndpointRecord(endpoint: {
    id: string;
    organizationId: string;
    url: string;
    secret: string;
    subscribedEvents: string[];
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): WebhookEndpointRecord {
    return {
      ...endpoint,
      subscribedEvents: endpoint.subscribedEvents as WebhookSubscriptionType[],
    };
  }

  private mapDeliveryRecord(delivery: {
    id: string;
    organizationId: string;
    endpointId: string;
    endpointUrl: string;
    eventId: string;
    eventType: string;
    requestBody: Record<string, unknown>;
    status: WebhookDeliveryStatus;
    attemptCount: number;
    responseCode: number | null;
    lastErrorMessage: string | null;
    sourceDeliveryId: string | null;
    lastAttemptedAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): WebhookDeliveryRecord {
    return delivery;
  }

  private extractResponseCode(errorMessage: string): number | null {
    const match = errorMessage.match(/status (\d{3})/);
    return match ? Number(match[1]) : null;
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for webhook operations.',
      );
    }

    return this.databaseService.db;
  }

  private generateSignature(
    secret: string,
    timestamp: string,
    body: string,
  ): string {
    return createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
  }
}
