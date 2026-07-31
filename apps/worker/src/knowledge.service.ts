import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Prisma } from '@feedback-agent/database';
import * as cheerio from 'cheerio';
import { PDFParse } from 'pdf-parse';

import { DatabaseService } from './database.service';
import { fetchPublicHtml } from './network-safety';
import { StorageService } from './storage.service';

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkText(value: string, size = 1400, overlap = 180): string[] {
  const text = normalizeText(value);
  if (!text) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const paragraph = text.lastIndexOf('\n', end);
      if (paragraph > start + size * 0.6) end = paragraph;
    }
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async ingestPdf(sourceId: string): Promise<void> {
    const source = await this.source(sourceId, 'PDF');
    if (!source.objectKey)
      throw new Error('PDF source does not have an object key');
    await this.markProcessing(sourceId);
    const parser = new PDFParse({
      data: await this.storage.get(source.objectKey),
    });
    try {
      const result = await parser.getText();
      const text = normalizeText(result.text);
      if (text.length < 40) {
        throw new Error('PDF contains no extractable text; OCR is not enabled');
      }
      await this.replaceChunks(
        source.id,
        source.appId,
        source.title,
        chunkText(text),
      );
      await this.embedSource(source.id);
      await this.markReady(source.id, {
        pages: result.total,
        characters: text.length,
      });
    } finally {
      await parser.destroy();
    }
  }

  async ingestUrl(sourceId: string): Promise<void> {
    const source = await this.source(sourceId, 'URL');
    if (!source.sourceUrl) throw new Error('URL source does not have a URL');
    await this.markProcessing(sourceId);
    const html = await fetchPublicHtml(source.sourceUrl);
    const $ = cheerio.load(html);
    $('script,style,noscript,svg,nav,footer,header,form').remove();
    const title = normalizeText($('title').first().text()) || source.title;
    const content = normalizeText(
      $('article').first().text() ||
        $('main').first().text() ||
        $('body').text(),
    );
    if (content.length < 80)
      throw new Error('Web page contains too little readable text');
    await this.database.client.knowledgeSource.update({
      where: { id: source.id },
      data: { title },
    });
    await this.replaceChunks(
      source.id,
      source.appId,
      title,
      chunkText(content),
    );
    await this.embedSource(source.id);
    await this.markReady(source.id, { characters: content.length });
  }

  async embedSource(sourceId: string): Promise<void> {
    const apiKey = this.config.get<string>('EMBEDDING_API_KEY');
    const model = this.config.get<string>('EMBEDDING_MODEL');
    if (!apiKey || !model) return;
    const dimensionValue = this.config.get<string>('EMBEDDING_DIMENSIONS');
    const dimensions = dimensionValue ? Number(dimensionValue) : undefined;
    const embeddings = new OpenAIEmbeddings({
      apiKey,
      model,
      dimensions,
      configuration: {
        baseURL: this.config.get<string>('EMBEDDING_BASE_URL') || undefined,
      },
    });
    const chunks = await this.database.client.knowledgeChunk.findMany({
      where: { sourceId },
      orderBy: { ordinal: 'asc' },
    });
    if (chunks.length === 0) return;
    const vectors = await embeddings.embedDocuments(
      chunks.map((chunk) => chunk.content),
    );
    const actualDimensions = vectors[0]?.length;
    if (!actualDimensions)
      throw new Error('Embedding provider returned an empty vector');
    if (dimensions && actualDimensions !== dimensions) {
      throw new Error(
        `Embedding dimension mismatch: configured ${dimensions}, received ${actualDimensions}`,
      );
    }
    const existing = await this.database.client.$queryRaw<
      Array<{ dimensions: number }>
    >(
      Prisma.sql`
        SELECT vector_dims(embedding) AS dimensions
        FROM "KnowledgeChunk"
        WHERE embedding IS NOT NULL
        LIMIT 1
      `,
    );
    if (existing[0] && Number(existing[0].dimensions) !== actualDimensions) {
      throw new Error(
        `Embedding dimension is locked to ${existing[0].dimensions}; reindex before changing providers`,
      );
    }
    for (const [index, chunk] of chunks.entries()) {
      const vector = vectors[index];
      if (!vector) continue;
      const encoded = `[${vector.join(',')}]`;
      await this.database.client.$executeRaw(Prisma.sql`
        UPDATE "KnowledgeChunk"
        SET embedding = ${encoded}::vector
        WHERE id = ${chunk.id}::uuid
      `);
    }
  }

  async markFailed(sourceId: string, error: unknown): Promise<void> {
    await this.database.client.knowledgeSource.updateMany({
      where: { id: sourceId },
      data: {
        status: 'FAILED',
        error:
          error instanceof Error ? error.message.slice(0, 4000) : String(error),
      },
    });
  }

  private async source(sourceId: string, type: 'PDF' | 'URL') {
    const source = await this.database.client.knowledgeSource.findFirst({
      where: { id: sourceId, type },
    });
    if (!source) throw new Error(`${type} source ${sourceId} was not found`);
    return source;
  }

  private markProcessing(id: string) {
    return this.database.client.knowledgeSource.update({
      where: { id },
      data: { status: 'PROCESSING', error: null },
    });
  }

  private markReady(id: string, metadata: Prisma.InputJsonValue) {
    return this.database.client.knowledgeSource.update({
      where: { id },
      data: { status: 'READY', metadata, error: null },
    });
  }

  private async replaceChunks(
    sourceId: string,
    appId: string,
    title: string,
    chunks: string[],
  ): Promise<void> {
    if (chunks.length === 0)
      throw new Error('No knowledge chunks were produced');
    await this.database.client.$transaction([
      this.database.client.knowledgeChunk.deleteMany({ where: { sourceId } }),
      this.database.client.knowledgeChunk.createMany({
        data: chunks.map((content, ordinal) => ({
          appId,
          sourceId,
          ordinal,
          title,
          content,
          tokenCount: Math.ceil(content.length / 3),
        })),
      }),
    ]);
  }
}
