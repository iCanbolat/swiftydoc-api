import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { InternalAuthRequest } from './auth.types';

@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<InternalAuthRequest>();
    const token = this.extractPortalToken(request.headers.authorization);

    request.currentPortalActor =
      await this.authService.verifyPortalAccessToken(token);

    return true;
  }

  private extractPortalToken(authorization?: string | string[]): string {
    const headerValue = Array.isArray(authorization)
      ? authorization[0]
      : authorization;

    if (!headerValue) {
      throw new UnauthorizedException(
        'Portal access token is missing or invalid.',
      );
    }

    const [scheme, token] = headerValue.trim().split(/\s+/, 2);

    if (scheme?.toLowerCase() !== 'portal' || !token) {
      throw new UnauthorizedException(
        'Portal access token is missing or invalid.',
      );
    }

    return token;
  }
}
