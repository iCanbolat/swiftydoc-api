import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, Subscription } from 'rxjs';
import type { InternalAuthRequest } from '../../modules/auth/auth.types';
import type { AuditSecurityContext } from './audit.types';
import { RequestAuditContextService } from './request-audit-context.service';

@Injectable()
export class RequestAuditContextInterceptor implements NestInterceptor {
  constructor(
    private readonly requestAuditContextService: RequestAuditContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<InternalAuthRequest>();
    const auditContext = this.buildAuditContext(request);

    return new Observable((subscriber) => {
      let subscription: Subscription | undefined;

      this.requestAuditContextService.run(auditContext, () => {
        try {
          subscription = next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (error) => subscriber.error(error),
            complete: () => subscriber.complete(),
          });
        } catch (error) {
          subscriber.error(error);
        }
      });

      return () => subscription?.unsubscribe();
    });
  }

  private buildAuditContext(request: InternalAuthRequest): AuditSecurityContext {
    if (request.currentActor) {
      return {
        activeWorkspaceId:
          request.resolvedWorkspaceId ??
          request.currentActor.session.activeWorkspaceId,
        authSurface: 'internal',
        impersonatorActorId: null,
        impersonatorSessionId: null,
        sessionId: request.currentActor.session.id,
      };
    }

    if (request.currentPortalActor) {
      return {
        activeWorkspaceId: null,
        authSurface: 'portal',
        impersonatorActorId: null,
        impersonatorSessionId: null,
        sessionId: null,
      };
    }

    return {
      activeWorkspaceId: null,
      authSurface: 'public',
      impersonatorActorId: null,
      impersonatorSessionId: null,
      sessionId: null,
    };
  }
}