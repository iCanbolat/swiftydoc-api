type ValueOf<T> = T[keyof T];

export const AUDIT_ACTIONS = {
  security: {
    internalAuthBootstrapCompleted:
      'security.internal_auth_bootstrap_completed',
    internalAuthEmailVerified: 'security.internal_auth_email_verified',
    internalAuthInviteCompleted: 'security.internal_auth_invite_completed',
    internalAuthPasswordResetCompleted:
      'security.internal_auth_password_reset_completed',
    internalAuthSessionStarted: 'security.internal_auth_session_started',
    internalAuthSessionRefreshed: 'security.internal_auth_session_refreshed',
    internalAuthSessionEnded: 'security.internal_auth_session_ended',
    portalAuthSessionStarted: 'security.portal_auth_session_started',
  },
  data_access: {
    brandingSettingsUpdated: 'data_access.branding_settings_updated',
    clientCreated: 'data_access.client_created',
    clientUpdated: 'data_access.client_updated',
    emailTemplateVariantUpserted: 'data_access.email_template_variant_upserted',
    exportJobCompleted: 'data_access.export_job_completed',
    exportJobDeliveryReplayed: 'data_access.export_job_delivery_replayed',
    exportJobFailed: 'data_access.export_job_failed',
    exportJobQueued: 'data_access.export_job_queued',
    fileUploaded: 'data_access.file_uploaded',
    commentCreated: 'data_access.comment_created',
    integrationConnectionCreated: 'data_access.integration_connection_created',
    integrationConnectionTested: 'data_access.integration_connection_tested',
    integrationSyncCompleted: 'data_access.integration_sync_completed',
    integrationSyncFailed: 'data_access.integration_sync_failed',
    integrationSyncQueued: 'data_access.integration_sync_queued',
    oauthApplicationCreated: 'data_access.oauth_application_created',
    oauthApplicationSecretRotated:
      'data_access.oauth_application_secret_rotated',
    oauthApplicationUpdated: 'data_access.oauth_application_updated',
    portalLinkCreated: 'data_access.portal_link_created',
    portalLinkVerified: 'data_access.portal_link_verified',
    requestClosed: 'data_access.request_closed',
    requestCreated: 'data_access.request_created',
    requestReminderSent: 'data_access.request_reminder_sent',
    requestReopened: 'data_access.request_reopened',
    requestSent: 'data_access.request_sent',
    reminderProviderConfigured: 'data_access.reminder_provider_configured',
    submissionItemApproved: 'data_access.submission_item_approved',
    submissionItemRejected: 'data_access.submission_item_rejected',
    submissionAutosaved: 'data_access.submission_autosaved',
    templateCreated: 'data_access.template_created',
    templateUpdated: 'data_access.template_updated',
    userEmailVerificationSent: 'data_access.user_email_verification_sent',
    userCreated: 'data_access.user_created',
    userInviteRevoked: 'data_access.user_invite_revoked',
    userInviteSent: 'data_access.user_invite_sent',
    userUpdated: 'data_access.user_updated',
    userPasswordResetRequested: 'data_access.user_password_reset_requested',
    workspaceCreated: 'data_access.workspace_created',
    workspaceUpdated: 'data_access.workspace_updated',
  },
  webhook: {
    deliveryFailed: 'webhook.delivery_failed',
    deliveryReplayed: 'webhook.delivery_replayed',
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
