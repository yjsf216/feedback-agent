import {
  Global,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

function connectionFromUrl(value: string) {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

@Injectable()
export class JobsService implements OnApplicationShutdown {
  readonly queue: Queue;

  constructor(config: ConfigService) {
    this.queue = new Queue('feedback-jobs', {
      connection: connectionFromUrl(config.getOrThrow<string>('REDIS_URL')),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });
  }

  async add(name: string, data: Record<string, unknown>, jobId?: string) {
    return this.queue.add(name, data, { jobId });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}

@Global()
@Module({ providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
