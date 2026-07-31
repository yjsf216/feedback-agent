import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';

import { DatabaseService } from './database.service';
import { FeedbackService } from './feedback.service';
import { KnowledgeService } from './knowledge.service';
import { ProcessorService } from './processor.service';
import { ReportsService } from './reports.service';
import { StorageService } from './storage.service';

const environmentSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().url(),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
  })
  .passthrough();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['../../.env', '.env'],
      validate: (value) => environmentSchema.parse(value),
    }),
  ],
  providers: [
    DatabaseService,
    StorageService,
    KnowledgeService,
    FeedbackService,
    ReportsService,
    ProcessorService,
  ],
})
export class AppModule {}
