import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { InternalAuthRequest } from './auth.types';

@Injectable()
export class OrganizationOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<InternalAuthRequest>();
    const actor = request.currentActor;

    if (!actor) {
      throw new UnauthorizedException('Bearer token is missing or invalid.');
    }

    if (!actor.roleNames.includes('organization_owner')) {
      throw new ForbiddenException(
        'Only organization owners can manage OAuth applications.',
      );
    }

    return true;
  }
}
