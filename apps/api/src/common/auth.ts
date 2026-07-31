import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthContext {
  sub: string;
  kind: 'user' | 'admin';
  appId?: string;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().auth,
);

abstract class BaseAuthGuard implements CanActivate {
  protected abstract readonly expectedKind: AuthContext['kind'];

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    if (!token) throw new UnauthorizedException('缺少访问令牌');

    try {
      const claims = await this.jwt.verifyAsync<AuthContext>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (claims.kind !== this.expectedKind) {
        throw new UnauthorizedException('令牌类型不匹配');
      }
      request.auth = claims;
      return true;
    } catch {
      throw new UnauthorizedException('访问令牌无效或已过期');
    }
  }
}

@Injectable()
export class UserAuthGuard extends BaseAuthGuard {
  protected readonly expectedKind = 'user' as const;

  constructor(jwt: JwtService, config: ConfigService) {
    super(jwt, config);
  }
}

@Injectable()
export class AdminAuthGuard extends BaseAuthGuard {
  protected readonly expectedKind = 'admin' as const;

  constructor(jwt: JwtService, config: ConfigService) {
    super(jwt, config);
  }
}
