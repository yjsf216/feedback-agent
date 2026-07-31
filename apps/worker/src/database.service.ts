import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { prisma } from '@feedback-agent/database';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly client = prisma;

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
