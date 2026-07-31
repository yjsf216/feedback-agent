import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import type {
  KnowledgeHit,
  KnowledgeRetriever,
} from '@feedback-agent/agent-core';
import { Prisma } from '@feedback-agent/database';

import { DatabaseService } from '../database/database.module';

interface KnowledgeRow {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  url: string | null;
  score: number;
}

@Injectable()
export class KnowledgeRetrieverService implements KnowledgeRetriever {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async search(input: {
    appId: string;
    query: string;
    limit: number;
  }): Promise<KnowledgeHit[]> {
    const embeddingKey = this.config.get<string>('EMBEDDING_API_KEY');
    const embeddingModel = this.config.get<string>('EMBEDDING_MODEL');
    if (embeddingKey && embeddingModel) {
      try {
        const semantic = await this.semanticSearch(
          input,
          embeddingKey,
          embeddingModel,
        );
        if (semantic.length > 0) return semantic;
      } catch {
        // Text retrieval remains available when an external embedding provider fails.
      }
    }
    return this.textSearch(input);
  }

  private async semanticSearch(
    input: { appId: string; query: string; limit: number },
    apiKey: string,
    model: string,
  ): Promise<KnowledgeHit[]> {
    const dimensionsValue = this.config.get<string>('EMBEDDING_DIMENSIONS');
    const dimensions = dimensionsValue ? Number(dimensionsValue) : undefined;
    const embeddings = new OpenAIEmbeddings({
      apiKey,
      model,
      dimensions,
      configuration: {
        baseURL: this.config.get<string>('EMBEDDING_BASE_URL') || undefined,
      },
    });
    const vector = `[${(await embeddings.embedQuery(input.query)).join(',')}]`;
    const rows = await this.database.client.$queryRaw<
      KnowledgeRow[]
    >(Prisma.sql`
      SELECT
        chunk.id,
        chunk."sourceId",
        chunk.title,
        chunk.content,
        source."sourceUrl" AS url,
        1 - (chunk.embedding <=> ${vector}::vector) AS score
      FROM "KnowledgeChunk" AS chunk
      INNER JOIN "KnowledgeSource" AS source ON source.id = chunk."sourceId"
      WHERE chunk."appId" = ${input.appId}::uuid
        AND chunk.embedding IS NOT NULL
        AND source.status = 'READY'
      ORDER BY chunk.embedding <=> ${vector}::vector
      LIMIT ${input.limit}
    `);
    return rows.map((row) => this.toHit(row));
  }

  private async textSearch(input: {
    appId: string;
    query: string;
    limit: number;
  }): Promise<KnowledgeHit[]> {
    const rows = await this.database.client.$queryRaw<
      KnowledgeRow[]
    >(Prisma.sql`
      SELECT
        chunk.id,
        chunk."sourceId",
        chunk.title,
        chunk.content,
        source."sourceUrl" AS url,
        GREATEST(
          similarity(chunk.title, ${input.query}),
          similarity(chunk.content, ${input.query})
        ) AS score
      FROM "KnowledgeChunk" AS chunk
      INNER JOIN "KnowledgeSource" AS source ON source.id = chunk."sourceId"
      WHERE chunk."appId" = ${input.appId}::uuid
        AND source.status = 'READY'
      ORDER BY score DESC, chunk."createdAt" DESC
      LIMIT ${input.limit}
    `);
    return rows.map((row) => this.toHit(row));
  }

  private toHit(row: KnowledgeRow): KnowledgeHit {
    return {
      id: row.id,
      sourceId: row.sourceId,
      title: row.title,
      content: row.content,
      url: row.url ?? undefined,
      score: Number(row.score),
    };
  }
}
