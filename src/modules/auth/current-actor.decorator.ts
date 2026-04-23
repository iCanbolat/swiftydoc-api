import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedInternalActor,
  InternalAuthRequest,
} from './auth.types';

export const CurrentActor = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthenticatedInternalActor | undefined => {
    const request = context.switchToHttp().getRequest<InternalAuthRequest>();
    return request.currentActor;
  },
);
