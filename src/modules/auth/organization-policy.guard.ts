import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { InternalAuthRequest } from './auth.types';
import { ORGANIZATION_POLICY_METADATA_KEY } from './organization-policy.decorator';
import {
  requiresVerifiedEmailForOrganizationPermissions,
  resolveOrganizationPermissions,
  type OrganizationPermission,
} from './organization-policy.types';

@Injectable()
export class OrganizationPolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<OrganizationPermission[]>(
        ORGANIZATION_POLICY_METADATA_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<InternalAuthRequest>();
    const actor = request.currentActor;

    if (!actor) {
      throw new UnauthorizedException('Bearer token is missing or invalid.');
    }

    if (
      !actor.user.emailVerifiedAt &&
      requiresVerifiedEmailForOrganizationPermissions(requiredPermissions)
    ) {
      throw new ForbiddenException(
        'Email verification is required before performing this organization-level action.',
      );
    }

    const grantedPermissions = resolveOrganizationPermissions(actor.roleNames);

    if (
      requiredPermissions.some((permission) =>
        grantedPermissions.has(permission),
      )
    ) {
      return true;
    }

    throw new ForbiddenException(
      'User does not have organization-level access to this resource.',
    );
  }
}
