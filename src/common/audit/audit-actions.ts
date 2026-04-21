type ValueOf<T> = T[keyof T];

export const AUDIT_ACTIONS = {
  security: {},
  data_access: {
    fileUploaded: 'data_access.file_uploaded',
  },
  webhook: {
    endpointRegistered: 'webhook.endpoint_registered',
    eventEmitted: 'webhook.event_emitted',
    deliverySucceeded: 'webhook.delivery_succeeded',
  },
  queue: {
    jobEnqueued: 'queue.job_enqueued',
    jobSkippedNoHandler: 'queue.job_skipped_no_handler',
    jobSucceeded: 'queue.job_succeeded',
    jobRequeued: 'queue.job_requeued',
    jobFailed: 'queue.job_failed',
  },
  system: {},
} as const;

export type AuditCategory = keyof typeof AUDIT_ACTIONS;

type AuditActionMap = typeof AUDIT_ACTIONS;

export type AuditActionForCategory<C extends AuditCategory> = ValueOf<
  AuditActionMap[C]
>;

export type AuditAction = {
  [Category in AuditCategory]: AuditActionForCategory<Category>;
}[AuditCategory];
