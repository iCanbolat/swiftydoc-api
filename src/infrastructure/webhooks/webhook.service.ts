import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import type {
  WebhookEventType,
  WebhookSubscriptionType,
} from '../../common/webhooks/webhook-events';
import { AuditLogService } from '../audit/audit-log.service';
import { JobQueueService } from '../queue/job-queue.service';
import type {
  WebhookDeliveryJobPayload,
  WebhookEndpoint,
} from './webhook.types';

@Injectable()
export class WebhookService implements OnModuleInit {
  private readonly logger = new Logger(WebhookService.name);
  private readonly endpoints = new Map<string, WebhookEndpoint>();

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService<RuntimeEnv, true>,
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

  registerEndpoint(input: {
    secret: string;
    subscribedEvents: WebhookSubscriptionType[];
    url: string;
  }): WebhookEndpoint {
    const endpoint: WebhookEndpoint = {
      id: randomUUID(),
      url: input.url,
      secret: input.secret,
      subscribedEvents:
        input.subscribedEvents.length > 0 ? input.subscribedEvents : ['*'],
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    this.endpoints.set(endpoint.id, endpoint);

    void this.auditLogService.record({
      category: 'webhook',
      action: AUDIT_ACTIONS.webhook.endpointRegistered,
      resourceType: RESOURCE_TYPES.automation.webhookEndpoint,
      resourceId: endpoint.id,
      metadata: {
        url: endpoint.url,
        subscribedEvents: endpoint.subscribedEvents,
      },
    });

    return endpoint;
  }

  listEndpoints(): WebhookEndpoint[] {
    return [...this.endpoints.values()];
  }

  async emitEvent(
    eventType: WebhookEventType,
    data: Record<string, unknown>,
    organizationId?: string,
  ): Promise<{ deliveredTo: number; eventId: string }> {
    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();

    const matchingEndpoints = this.listEndpoints().filter(
      (endpoint) =>
        endpoint.enabled &&
        (endpoint.subscribedEvents.includes('*') ||
          endpoint.subscribedEvents.includes(eventType)),
    );

    for (const endpoint of matchingEndpoints) {
      await this.jobQueueService.enqueue('webhook.deliver', {
        endpoint,
        event: {
          id: eventId,
          type: eventType,
          occurred_at: occurredAt,
          organization_id: organizationId,
          data,
        },
      });
    }

    await this.auditLogService.record({
      category: 'webhook',
      action: AUDIT_ACTIONS.webhook.eventEmitted,
      organizationId,
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
    const requestBody = JSON.stringify(payload.event);
    const timestamp = new Date().toISOString();
    const signature = this.generateSignature(
      payload.endpoint.secret,
      timestamp,
      requestBody,
    );

    const controller = new AbortController();
    const timeoutMs = this.configService.get('WEBHOOK_DELIVERY_TIMEOUT_MS', {
      infer: true,
    });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(payload.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SwiftyDoc-Delivery-Id': randomUUID(),
          'X-SwiftyDoc-Event': payload.event.type,
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

      await this.auditLogService.record({
        category: 'webhook',
        action: AUDIT_ACTIONS.webhook.deliverySucceeded,
        organizationId: payload.event.organization_id,
        resourceType: RESOURCE_TYPES.automation.webhookEvent,
        resourceId: payload.event.id,
        metadata: {
          endpointId: payload.endpoint.id,
          eventType: payload.event.type,
        },
      });
    } finally {
      clearTimeout(timeout);
    }
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
