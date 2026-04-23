import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { InternalAuthRequest } from './auth.types';

export const CurrentWorkspaceId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<InternalAuthRequest>();
    return request.resolvedWorkspaceId;
  },
);
