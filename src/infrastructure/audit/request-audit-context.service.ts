import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuditSecurityContext } from './audit.types';

@Injectable()
export class RequestAuditContextService {
  private readonly storage = new AsyncLocalStorage<AuditSecurityContext>();

  getContext(): AuditSecurityContext | undefined {
    return this.storage.getStore();
  }

  run<T>(context: AuditSecurityContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }
}