import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';
import { RedisService } from '../redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async health() {
    await this.database.client.$queryRaw`SELECT 1`;
    if (this.redis.client.status === 'wait') await this.redis.client.connect();
    await this.redis.client.ping();
    return {
      status: 'ok',
      service: 'feedback-agent-api',
      timestamp: new Date().toISOString(),
    };
  }
}
