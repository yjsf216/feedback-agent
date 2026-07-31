import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  createGuestRequestSchema,
  emailLoginRequestSchema,
  emailRegisterRequestSchema,
  exchangeTokenRequestSchema,
} from '@feedback-agent/contracts';
import { z } from 'zod';

import { parseBody } from '../common/parse';
import { AuthService } from './auth.service';

const tokenBodySchema = z.object({ refreshToken: z.string().min(20) });
const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('guest')
  createGuest(@Body() body: unknown) {
    return this.auth.createGuest(parseBody(createGuestRequestSchema, body));
  }

  @Post('exchange')
  exchange(@Body() body: unknown) {
    return this.auth.exchange(parseBody(exchangeTokenRequestSchema, body));
  }

  @Post('email/register')
  register(@Body() body: unknown) {
    return this.auth.registerEmail(parseBody(emailRegisterRequestSchema, body));
  }

  @HttpCode(200)
  @Post('email/login')
  login(@Body() body: unknown) {
    return this.auth.loginEmail(parseBody(emailLoginRequestSchema, body));
  }

  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() body: unknown) {
    const input = parseBody(tokenBodySchema, body);
    return this.auth.refresh(input.refreshToken);
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@Body() body: unknown) {
    const input = parseBody(tokenBodySchema, body);
    await this.auth.logout(input.refreshToken);
  }
}

@Controller('v1/admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @HttpCode(200)
  @Post('login')
  login(@Body() body: unknown) {
    const input = parseBody(adminLoginSchema, body);
    return this.auth.loginAdmin(input.email, input.password);
  }

  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() body: unknown) {
    const input = parseBody(tokenBodySchema, body);
    return this.auth.refresh(input.refreshToken);
  }
}
