export interface QueueJob<TPayload = unknown> {
  id: string;
  type: string;
  payload: TPayload;
  attempt: number;
  maxAttempts: number;
  enqueuedAt: Date;
}

export type QueueHandler<TPayload = unknown> = (
  job: QueueJob<TPayload>,
) => Promise<void>;
