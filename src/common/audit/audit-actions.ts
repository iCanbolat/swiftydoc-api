type ValueOf<T> = T[keyof T];

export const AUDIT_ACTIONS = {
  security: {},
  data_access: {
    fileUploaded: 'data_access.file_uploaded',
    commentCreated: 'data_access.comment_created',
    portalLinkCreated: 'data_access.portal_link_created',
    portalLinkVerified: 'data_access.portal_link_verified',
    requestClosed: 'data_access.request_closed',
    requestCreated: 'data_access.request_created',
    requestReopened: 'data_access.request_reopened',
    requestSent: 'data_access.request_sent',
    submissionItemApproved: 'data_access.submission_item_approved',
    submissionItemRejected: 'data_access.submission_item_rejected',
    submissionAutosaved: 'data_access.submission_autosaved',
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
