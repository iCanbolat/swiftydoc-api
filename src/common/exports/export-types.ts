export const EXPORT_JOB_TYPE_VALUES = [
  'zip',
  'pdf_summary',
  'csv_metadata',
] as const;

export type ExportJobType = (typeof EXPORT_JOB_TYPE_VALUES)[number];

export const EXPORT_JOB_STATUS_VALUES = [
  'queued',
  'processing',
  'completed',
  'failed',
] as const;

export type ExportJobStatus = (typeof EXPORT_JOB_STATUS_VALUES)[number];
