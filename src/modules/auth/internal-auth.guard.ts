import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { InternalAuthRequest } from './auth.types';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<InternalAuthRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    request.currentActor = await this.authService.getCurrentActor(token);
    return true;
  }

  private extractBearerToken(authorization?: string | string[]): string {
    const headerValue = Array.isArray(authorization)
      ? authorization[0]
      : authorization;

    if (!headerValue) {
      throw new UnauthorizedException('Bearer token is missing or invalid.');
    }

    const [scheme, token] = headerValue.trim().split(/\s+/, 2);

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Bearer token is missing or invalid.');
    }

    return token;
  }
}
