import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Job, Worker } from 'bullmq';

import { FeedbackService } from './feedback.service';
import { KnowledgeService } from './knowledge.service';
import { ReportsService } from './reports.service';

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
export class ProcessorService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ProcessorService.name);
  private worker?: Worker;
  private idleTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly config: ConfigService,
    private readonly knowledge: KnowledgeService,
    private readonly feedback: FeedbackService,
    private readonly reports: ReportsService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker('feedback-jobs', (job) => this.process(job), {
      connection: connectionFromUrl(
        this.config.getOrThrow<string>('REDIS_URL'),
      ),
      concurrency: 4,
    });
    this.worker.on('completed', (job) => {
      this.logger.log(`Completed ${job.name} (${job.id})`);
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Failed ${job?.name} (${job?.id}): ${error.message}`);
    });
    void this.feedback.finalizeIdleConversations();
    this.idleTimer = setInterval(
      () => {
        void this.feedback.finalizeIdleConversations();
      },
      5 * 60 * 1000,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.idleTimer) clearInterval(this.idleTimer);
    if (this.worker) await this.worker.close();
  }

  private async process(job: Job): Promise<void> {
    const sourceId = this.stringValue(job.data, 'sourceId');
    const reportId = this.stringValue(job.data, 'reportId');
    try {
      switch (job.name) {
        case 'knowledge.ingest-pdf':
          await this.knowledge.ingestPdf(sourceId);
          break;
        case 'knowledge.ingest-url':
          await this.knowledge.ingestUrl(sourceId);
          break;
        case 'knowledge.embed':
          await this.knowledge.embedSource(sourceId);
          break;
        case 'feedback.extract':
          await this.feedback.extract(this.stringValue(job.data, 'feedbackId'));
          break;
        case 'conversation.finalize':
          await this.feedback.finalizeConversation(
            this.stringValue(job.data, 'conversationId'),
          );
          break;
        case 'report.generate':
          await this.reports.generate(reportId);
          break;
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      if (job.name.startsWith('knowledge.') && sourceId) {
        await this.knowledge.markFailed(sourceId, error);
      }
      if (job.name === 'report.generate' && reportId) {
        await this.reports.markFailed(reportId, error);
      }
      throw error;
    }
  }

  private stringValue(data: unknown, key: string): string {
    if (
      typeof data === 'object' &&
      data !== null &&
      key in data &&
      typeof (data as Record<string, unknown>)[key] === 'string'
    ) {
      return (data as Record<string, string>)[key];
    }
    return '';
  }
}
