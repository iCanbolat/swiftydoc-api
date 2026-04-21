import type {
  WebhookEventType,
  WebhookSubscriptionType,
} from '../../common/webhooks/webhook-events';

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  subscribedEvents: WebhookSubscriptionType[];
  enabled: boolean;
  createdAt: string;
}

export interface WebhookEventEnvelope {
  id: string;
  type: WebhookEventType;
  occurred_at: string;
  organization_id?: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryJobPayload {
  endpoint: WebhookEndpoint;
  event: WebhookEventEnvelope;
}
