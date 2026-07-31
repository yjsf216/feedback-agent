import { BadRequestException } from '@nestjs/common';
import { z, type ZodType } from 'zod';

export function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: '请求参数不符合要求',
      issues: result.error.issues,
    });
  }
  return result.data;
}

export function optionalAppScope(
  value: string | undefined,
): string | undefined {
  if (!value || value === 'all') return undefined;
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      code: 'INVALID_APP_SCOPE',
      message: 'X-App-Id 必须是有效的应用 ID',
    });
  }
  return result.data;
}

export function requiredAppScope(value: string | undefined): string {
  const appId = optionalAppScope(value);
  if (!appId) {
    throw new BadRequestException({
      code: 'APP_SCOPE_REQUIRED',
      message: '请先选择一个应用',
    });
  }
  return appId;
}

export function takeLimit(value: string | undefined, fallback = 30): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 1), 100)
    : fallback;
}
