import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash as hashPassword, verify as verifyPassword } from 'argon2';
import type {
  AccessTokenResponse,
  CreateGuestRequest,
  EmailLoginRequest,
  EmailRegisterRequest,
  ExchangeTokenRequest,
} from '@feedback-agent/contracts';
import type { AdminUser, EndUser } from '@feedback-agent/database';

import type { AuthContext } from '../common/auth';
import { CryptoService } from '../common/crypto.service';
import { DatabaseService } from '../database/database.module';
import { RedisService } from '../redis/redis.module';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async activeApp(appId: string) {
    const app = await this.database.client.app.findFirst({
      where: { id: appId, status: 'ACTIVE' },
      include: { authConfig: true },
    });
    if (!app) throw new ForbiddenException('应用不存在或已停用');
    return app;
  }

  async createGuest(input: CreateGuestRequest): Promise<AccessTokenResponse> {
    const app = await this.activeApp(input.appId);
    if (!app.authConfig?.allowGuest) {
      throw new ForbiddenException('该应用未开启游客访问');
    }

    const identity = await this.database.client.userIdentity.findUnique({
      where: {
        appId_type_issuer_subject: {
          appId: input.appId,
          type: 'GUEST',
          issuer: 'feedback-agent',
          subject: input.guestId,
        },
      },
      include: { endUser: true },
    });

    const user =
      identity?.endUser ??
      (await this.database.client.endUser.create({
        data: {
          displayName: '访客',
          identities: {
            create: {
              appId: input.appId,
              type: 'GUEST',
              subject: input.guestId,
            },
          },
        },
      }));

    if (identity) {
      await this.database.client.userIdentity.update({
        where: { id: identity.id },
        data: { lastSeenAt: new Date() },
      });
    }
    return this.issueUserTokens(user, input.appId);
  }

  async exchange(input: ExchangeTokenRequest): Promise<AccessTokenResponse> {
    await this.activeApp(input.appId);
    if (Math.abs(Date.now() - input.timestamp) > 5 * 60 * 1000) {
      throw new UnauthorizedException('签名时间已过期');
    }

    if (this.redis.client.status === 'wait') await this.redis.client.connect();
    const nonceAccepted = await this.redis.client.set(
      `exchange-nonce:${input.appId}:${input.nonce}`,
      '1',
      'EX',
      600,
      'NX',
    );
    if (!nonceAccepted) throw new UnauthorizedException('nonce 已被使用');

    const credential = await this.database.client.appCredential.findFirst({
      where: {
        appId: input.appId,
        keyId: input.keyId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!credential) throw new UnauthorizedException('应用凭证无效');

    const canonical = [
      input.appId,
      input.externalUserId,
      input.timestamp,
      input.nonce,
    ].join('.');
    const expected = this.crypto.hmac(
      canonical,
      this.crypto.decrypt(credential.secretEncrypted),
    );
    if (!this.crypto.safeEqual(expected, input.signature.toLowerCase())) {
      throw new UnauthorizedException('签名校验失败');
    }

    const existing = await this.database.client.userIdentity.findUnique({
      where: {
        appId_type_issuer_subject: {
          appId: input.appId,
          type: 'APP_SSO',
          issuer: input.keyId,
          subject: input.externalUserId,
        },
      },
      include: { endUser: true },
    });

    const user =
      existing?.endUser ??
      (await this.database.client.endUser.create({
        data: {
          displayName: input.displayName,
          identities: {
            create: {
              appId: input.appId,
              type: 'APP_SSO',
              issuer: input.keyId,
              subject: input.externalUserId,
              email: input.email?.toLowerCase(),
              emailVerified: Boolean(input.email),
            },
          },
        },
      }));

    await this.database.client.appCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    });
    return this.issueUserTokens(user, input.appId);
  }

  async registerEmail(input: EmailRegisterRequest) {
    const app = await this.activeApp(input.appId);
    if (!app.authConfig?.allowEmail) {
      throw new ForbiddenException('该应用未开启邮箱登录');
    }
    const subject = input.email.trim().toLowerCase();
    const exists = await this.database.client.userIdentity.findUnique({
      where: {
        appId_type_issuer_subject: {
          appId: input.appId,
          type: 'EMAIL',
          issuer: 'feedback-agent',
          subject,
        },
      },
    });
    if (exists) throw new ConflictException('邮箱已注册');

    const user = await this.database.client.endUser.create({
      data: {
        displayName: input.displayName ?? subject.split('@')[0],
        identities: {
          create: {
            appId: input.appId,
            type: 'EMAIL',
            subject,
            email: subject,
            passwordHash: await hashPassword(input.password),
          },
        },
      },
    });
    return this.issueUserTokens(user, input.appId);
  }

  async loginEmail(input: EmailLoginRequest) {
    const app = await this.activeApp(input.appId);
    if (!app.authConfig?.allowEmail) {
      throw new ForbiddenException('该应用未开启邮箱登录');
    }
    const identity = await this.database.client.userIdentity.findUnique({
      where: {
        appId_type_issuer_subject: {
          appId: input.appId,
          type: 'EMAIL',
          issuer: 'feedback-agent',
          subject: input.email.trim().toLowerCase(),
        },
      },
      include: { endUser: true },
    });
    if (
      !identity?.passwordHash ||
      !(await verifyPassword(identity.passwordHash, input.password))
    ) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }
    return this.issueUserTokens(identity.endUser, input.appId);
  }

  async loginAdmin(email: string, password: string) {
    const admin = await this.database.client.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (
      !admin?.enabled ||
      !(await verifyPassword(admin.passwordHash, password))
    ) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }
    await this.database.client.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueAdminTokens(admin);
  }

  async refresh(refreshToken: string): Promise<AccessTokenResponse> {
    const session = await this.database.client.authSession.findUnique({
      where: { tokenHash: this.crypto.hash(refreshToken) },
      include: { endUser: true, adminUser: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
    await this.database.client.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    if (session.endUser) {
      return this.issueUserTokens(session.endUser, session.appId ?? undefined);
    }
    if (session.adminUser) return this.issueAdminTokens(session.adminUser);
    throw new UnauthorizedException('刷新会话无效');
  }

  async logout(refreshToken: string): Promise<void> {
    await this.database.client.authSession.updateMany({
      where: { tokenHash: this.crypto.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueUserTokens(user: EndUser, appId?: string) {
    return this.issueTokens(
      { sub: user.id, kind: 'user', appId },
      { id: user.id, displayName: user.displayName },
    );
  }

  private async issueAdminTokens(admin: AdminUser) {
    return this.issueTokens(
      { sub: admin.id, kind: 'admin', email: admin.email },
      { id: admin.id, displayName: admin.name },
    );
  }

  private async issueTokens(
    claims: AuthContext,
    user: AccessTokenResponse['user'],
  ): Promise<AccessTokenResponse> {
    const expiresIn = 15 * 60;
    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn,
    });
    const refreshToken = this.crypto.randomToken(48);
    await this.database.client.authSession.create({
      data: {
        endUserId: claims.kind === 'user' ? claims.sub : undefined,
        adminUserId: claims.kind === 'admin' ? claims.sub : undefined,
        appId: claims.appId,
        tokenHash: this.crypto.hash(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken, expiresIn, user };
  }
}
