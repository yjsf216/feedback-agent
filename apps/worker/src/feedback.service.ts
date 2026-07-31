import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { Prisma } from '@feedback-agent/database';
import { createDecipheriv, createHash } from 'node:crypto';
import { z } from 'zod';

import { DatabaseService } from './database.service';

const extractionSchema = z.object({
  title: z.string().min(2).max(240),
  summary: z.string().min(2).max(5000),
  painPoint: z.string().min(2).max(5000),
  proposedSolution: z.string().max(5000).optional(),
  category: z.string().max(120),
  priority: z.number().int().min(1).max(4),
  confidence: z.number().min(0).max(1),
});

type Extraction = z.infer<typeof extractionSchema>;

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async extract(feedbackId: string): Promise<void> {
    const feedback = await this.database.client.feedbackItem.findUnique({
      where: { id: feedbackId },
      include: {
        conversation: {
          include: { messages: { orderBy: { createdAt: 'asc' }, take: 30 } },
        },
        app: { include: { modelConfig: true } },
      },
    });
    if (!feedback) throw new Error(`Feedback ${feedbackId} was not found`);
    if (!['BUG', 'FEATURE_REQUEST', 'COMPLAINT'].includes(feedback.kind)) {
      await this.database.client.feedbackItem.update({
        where: { id: feedback.id },
        data: { status: 'REVIEWED' },
      });
      return;
    }

    let extraction: Extraction;
    try {
      extraction = await this.extractWithModel(feedback);
    } catch (error) {
      this.logger.warn(
        `AI extraction failed; using fallback: ${String(error)}`,
      );
      extraction = this.fallback(feedback.kind, feedback.description);
    }

    const similar = await this.database.client.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT id
        FROM "Requirement"
        WHERE "appId" = ${feedback.appId}::uuid
          AND status IN ('DRAFT', 'APPROVED', 'PLANNED', 'IN_PROGRESS')
          AND similarity(title, ${extraction.title}) >= 0.46
        ORDER BY similarity(title, ${extraction.title}) DESC
        LIMIT 1
      `,
    );

    await this.database.client.$transaction(async (tx) => {
      const existingId = similar[0]?.id;
      if (existingId) {
        await tx.requirementFeedback.createMany({
          data: [{ requirementId: existingId, feedbackId: feedback.id }],
          skipDuplicates: true,
        });
        await tx.requirement.update({
          where: { id: existingId },
          data: { frequency: { increment: 1 } },
        });
      } else {
        await tx.requirement.create({
          data: {
            appId: feedback.appId,
            title: extraction.title,
            summary: extraction.summary,
            painPoint: extraction.painPoint,
            proposedSolution: extraction.proposedSolution,
            category: extraction.category,
            priority: extraction.priority,
            source: 'AI',
            status: 'DRAFT',
            aiConfidence: extraction.confidence,
            feedbackItems: { create: { feedbackId: feedback.id } },
          },
        });
      }
      await tx.feedbackItem.update({
        where: { id: feedback.id },
        data: {
          status: 'LINKED',
          painPoint: extraction.painPoint,
          aiConfidence: extraction.confidence,
        },
      });
    });
  }

  async finalizeConversation(conversationId: string): Promise<void> {
    const conversation = await this.database.client.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 40 } },
    });
    if (!conversation) return;
    const summary = conversation.messages
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n')
      .slice(0, 4000);
    await this.database.client.conversation.update({
      where: { id: conversationId },
      data: {
        summary,
        finalizedAt: conversation.finalizedAt ?? new Date(),
      },
    });
  }

  async finalizeIdleConversations(): Promise<number> {
    const idle = await this.database.client.conversation.findMany({
      where: {
        status: 'OPEN',
        finalizedAt: null,
        lastMessageAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      select: { id: true, aiConfidence: true },
      take: 200,
    });
    for (const conversation of idle) {
      const unresolved = (conversation.aiConfidence ?? 0) < 0.72;
      await this.database.client.$transaction(async (tx) => {
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            status: unresolved ? 'UNRESOLVED' : 'RESOLVED',
            finalizedAt: new Date(),
          },
        });
        if (unresolved) {
          await tx.unresolvedCase.upsert({
            where: { conversationId: conversation.id },
            create: {
              conversationId: conversation.id,
              reason: '对话闲置结束，置信度不足',
            },
            update: { status: 'OPEN', reason: '对话闲置结束，置信度不足' },
          });
        }
      });
      await this.finalizeConversation(conversation.id);
    }
    return idle.length;
  }

  private async extractWithModel(feedback: {
    kind: string;
    description: string;
    app: {
      modelConfig: {
        apiKeyEncrypted: string | null;
        baseUrl: string | null;
        model: string;
        temperature: number;
        enabled: boolean;
      } | null;
    };
    conversation: { messages: Array<{ role: string; content: string }> };
  }): Promise<Extraction> {
    const modelConfig = feedback.app.modelConfig;
    const key = modelConfig?.apiKeyEncrypted
      ? this.decrypt(modelConfig.apiKeyEncrypted)
      : this.config.get<string>('CHAT_API_KEY');
    if (!key || modelConfig?.enabled === false)
      throw new Error('No AI model key configured');
    const chat = new ChatOpenAI({
      apiKey: key,
      model:
        modelConfig?.model ?? this.config.get('CHAT_MODEL', 'deepseek-chat'),
      temperature: modelConfig?.temperature ?? 0.2,
      configuration: {
        baseURL: modelConfig?.baseUrl ?? this.config.get('CHAT_BASE_URL'),
      },
    });
    const structured = chat.withStructuredOutput(extractionSchema, {
      name: 'extract_product_requirement',
      method: 'jsonMode',
    });
    return structured.invoke([
      [
        'system',
        'Return JSON. Convert the evidence into one concise product requirement draft. Preserve the user pain point and do not invent facts. priority: 1 low, 4 urgent. This is a draft for administrator review, never an approved decision.',
      ],
      [
        'human',
        `Feedback type: ${feedback.kind}\nPrimary feedback: ${feedback.description}\nConversation:\n${feedback.conversation.messages.map((item) => `${item.role}: ${item.content}`).join('\n')}`,
      ],
    ]);
  }

  private fallback(kind: string, description: string): Extraction {
    const clean = description.replace(/\s+/g, ' ').trim();
    return {
      title: clean.slice(0, 100),
      summary: clean,
      painPoint: clean,
      proposedSolution:
        kind === 'FEATURE_REQUEST'
          ? '评估用户场景并设计可验证的解决方案。'
          : undefined,
      category:
        kind === 'BUG'
          ? '稳定性'
          : kind === 'COMPLAINT'
            ? '体验问题'
            : '功能建议',
      priority: kind === 'BUG' || kind === 'COMPLAINT' ? 3 : 2,
      confidence: 0.58,
    };
  }

  private decrypt(value: string): string {
    const configured = this.config.get<string>('APP_ENCRYPTION_KEY', '');
    const decoded = Buffer.from(configured, 'base64');
    const key =
      decoded.length === 32
        ? decoded
        : createHash('sha256')
            .update(configured || 'local-development')
            .digest();
    const [ivValue, tagValue, encryptedValue] = value.split('.');
    if (!ivValue || !tagValue || !encryptedValue)
      throw new Error('Invalid encrypted key');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
