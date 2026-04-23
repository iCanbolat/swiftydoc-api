import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedPortalActor,
  InternalAuthRequest,
} from './auth.types';

export const CurrentPortalActor = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthenticatedPortalActor | undefined => {
    const request = context.switchToHttp().getRequest<InternalAuthRequest>();
    return request.currentPortalActor;
  },
);
