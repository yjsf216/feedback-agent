import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateConversationRequest,
  ResolutionRequest,
  SendMessageRequest,
} from '@feedback-agent/contracts';
import { Prisma, type FeedbackKind } from '@feedback-agent/database';

import { AgentService } from '../agent/agent.service';
import type { AuthContext } from '../common/auth';
import { DatabaseService } from '../database/database.module';
import { JobsService } from '../jobs/jobs.module';

export interface ConversationReply {
  messageId: string;
  content: string;
  confidence: number;
  status: 'OPEN' | 'UNRESOLVED';
  sources: Array<{ id: string; title: string; url?: string }>;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly agent: AgentService,
    private readonly jobs: JobsService,
  ) {}

  async create(auth: AuthContext, input: CreateConversationRequest) {
    this.assertApp(auth, input.appId);
    const app = await this.database.client.app.findFirst({
      where: { id: input.appId, status: 'ACTIVE' },
    });
    if (!app) throw new NotFoundException('应用不存在或已停用');
    return this.database.client.conversation.create({
      data: {
        appId: input.appId,
        endUserId: auth.sub,
        channel: input.channel,
        locale: input.locale,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async list(auth: AuthContext, appId?: string) {
    if (appId) this.assertApp(auth, appId);
    return this.database.client.conversation.findMany({
      where: { endUserId: auth.sub, appId: appId ?? auth.appId },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async detail(auth: AuthContext, id: string) {
    const conversation = await this.ownedConversation(auth, id);
    return this.database.client.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async sendMessage(
    auth: AuthContext,
    conversationId: string,
    input: SendMessageRequest,
  ): Promise<ConversationReply> {
    const conversation = await this.ownedConversation(auth, conversationId);
    if (conversation.status === 'CLOSED') {
      throw new ForbiddenException('该对话已关闭');
    }

    const duplicate = await this.database.client.message.findUnique({
      where: {
        conversationId_clientMessageId: {
          conversationId,
          clientMessageId: input.clientMessageId,
        },
      },
    });
    if (duplicate) {
      const assistant = await this.database.client.message.findFirst({
        where: {
          conversationId,
          role: 'ASSISTANT',
          createdAt: { gte: duplicate.createdAt },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (assistant) {
        const citations = Array.isArray(assistant.citations)
          ? (assistant.citations as ConversationReply['sources'])
          : [];
        return {
          messageId: assistant.id,
          content: assistant.content,
          confidence: conversation.aiConfidence ?? 0,
          status: conversation.status === 'UNRESOLVED' ? 'UNRESOLVED' : 'OPEN',
          sources: citations,
        };
      }
    }

    const userMessage =
      duplicate ??
      (await this.database.client.message.create({
        data: {
          conversationId,
          clientMessageId: input.clientMessageId,
          role: 'USER',
          content: input.content,
        },
      }));

    const recent = await this.database.client.message.findMany({
      where: { conversationId, id: { not: userMessage.id } },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const result = await this.agent.run({
      appId: conversation.appId,
      conversationId,
      locale: conversation.locale === 'en' ? 'en' : 'zh-CN',
      message: input.content,
      history: recent
        .reverse()
        .filter((message) => message.role !== 'SYSTEM')
        .map((message) => ({
          role: message.role as 'USER' | 'ASSISTANT',
          content: message.content,
        })),
    });

    const sources = result.sources.map((source) => ({
      id: source.sourceId,
      title: source.title,
      url: source.url,
    }));
    const status = result.unresolved ? 'UNRESOLVED' : 'OPEN';
    const assistant = await this.database.client.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: result.answer,
          intent: result.intent,
          citations: sources,
          model: 'feedback-agent',
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          subject: conversation.subject ?? input.content.slice(0, 80),
          status,
          aiConfidence: result.confidence,
          lastMessageAt: new Date(),
        },
      });
      if (result.unresolved) {
        await tx.unresolvedCase.upsert({
          where: { conversationId },
          create: {
            conversationId,
            reason: 'AI 置信度低于自动解决阈值',
            priority: result.intent === 'BUG' ? 3 : 2,
          },
          update: {
            reason: 'AI 置信度低于自动解决阈值',
            status: 'OPEN',
          },
        });
      }
      return created;
    });

    const feedback = await this.database.client.feedbackItem.create({
      data: {
        appId: conversation.appId,
        conversationId,
        messageId: userMessage.id,
        endUserId: auth.sub,
        kind: this.feedbackKind(result.intent),
        title: input.content.slice(0, 120),
        description: input.content,
        severity:
          result.intent === 'BUG' || result.intent === 'COMPLAINT' ? 3 : 2,
        aiConfidence: result.confidence,
        evidence: [{ messageId: userMessage.id, content: input.content }],
      },
    });
    await this.jobs.add(
      'feedback.extract',
      { feedbackId: feedback.id, conversationId },
      `extract-${feedback.id}`,
    );

    return {
      messageId: assistant.id,
      content: assistant.content,
      confidence: result.confidence,
      status,
      sources,
    };
  }

  async setResolution(
    auth: AuthContext,
    conversationId: string,
    input: ResolutionRequest,
  ) {
    await this.ownedConversation(auth, conversationId);
    const status = input.resolved ? 'RESOLVED' : 'UNRESOLVED';
    const conversation = await this.database.client.conversation.update({
      where: { id: conversationId },
      data: {
        status,
        resolutionNote: input.comment,
        finalizedAt: input.resolved ? new Date() : undefined,
      },
    });
    if (!input.resolved) {
      await this.database.client.unresolvedCase.upsert({
        where: { conversationId },
        create: {
          conversationId,
          reason: input.comment || '用户反馈问题仍未解决',
          priority: 3,
        },
        update: {
          reason: input.comment || '用户反馈问题仍未解决',
          status: 'OPEN',
        },
      });
    }
    await this.jobs.add(
      'conversation.finalize',
      { conversationId },
      `finalize-${conversationId}-${Date.now()}`,
    );
    return conversation;
  }

  async close(auth: AuthContext, conversationId: string) {
    await this.ownedConversation(auth, conversationId);
    const conversation = await this.database.client.conversation.update({
      where: { id: conversationId },
      data: { status: 'CLOSED', finalizedAt: new Date() },
    });
    await this.jobs.add('conversation.finalize', { conversationId });
    return conversation;
  }

  private async ownedConversation(auth: AuthContext, id: string) {
    const conversation = await this.database.client.conversation.findFirst({
      where: { id, endUserId: auth.sub },
    });
    if (!conversation) throw new NotFoundException('对话不存在');
    this.assertApp(auth, conversation.appId);
    return conversation;
  }

  private assertApp(auth: AuthContext, appId: string): void {
    if (auth.appId && auth.appId !== appId) {
      throw new ForbiddenException('不能访问其他应用的数据');
    }
  }

  private feedbackKind(intent: string): FeedbackKind {
    const allowed: FeedbackKind[] = [
      'BUG',
      'FEATURE_REQUEST',
      'COMPLAINT',
      'PRAISE',
      'QUESTION',
      'OTHER',
    ];
    return allowed.includes(intent as FeedbackKind)
      ? (intent as FeedbackKind)
      : 'OTHER';
  }
}
