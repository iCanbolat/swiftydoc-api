type ValueOf<T> = T[keyof T];

export const WEBHOOK_EVENTS = {
  comments: {
    created: 'comment.created',
  },
  files: {
    uploaded: 'file.uploaded',
  },
  integrations: {
    syncCompleted: 'integration.sync.completed',
    syncFailed: 'integration.sync.failed',
  },
  requests: {
    completed: 'request.completed',
    created: 'request.created',
    overdue: 'request.overdue',
    reminderSent: 'request.reminder_sent',
    sent: 'request.sent',
    viewed: 'request.viewed',
  },
  reviews: {
    approved: 'item.approved',
    rejected: 'item.rejected',
  },
  submissions: {
    updated: 'submission.updated',
  },
} as const;

type WebhookEventMap = typeof WEBHOOK_EVENTS;

export type WebhookEventType = {
  [Group in keyof WebhookEventMap]: ValueOf<WebhookEventMap[Group]>;
}[keyof WebhookEventMap];

export const WEBHOOK_EVENT_TYPES = Object.values(WEBHOOK_EVENTS).flatMap(
  (group) => Object.values(group),
) as WebhookEventType[];

export type WebhookSubscriptionType = WebhookEventType | '*';

export const WEBHOOK_SUBSCRIPTION_TYPES = [
  '*',
  ...WEBHOOK_EVENT_TYPES,
] as const satisfies readonly WebhookSubscriptionType[];
