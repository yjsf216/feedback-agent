import { Module } from '@nestjs/common';

import { AdminAuthGuard, UserAuthGuard } from '../common/auth';
import { CryptoService } from '../common/crypto.service';
import { AdminAuthController, AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService, CryptoService, UserAuthGuard, AdminAuthGuard],
  exports: [AuthService, CryptoService, UserAuthGuard, AdminAuthGuard],
})
export class AuthModule {}
