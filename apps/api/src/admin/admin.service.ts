import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreateFaqRequest,
  CreateUrlSourceRequest,
} from '@feedback-agent/contracts';
import { Prisma } from '@feedback-agent/database';

import type { AuthContext } from '../common/auth';
import { CryptoService } from '../common/crypto.service';
import { DatabaseService } from '../database/database.module';
import { JobsService } from '../jobs/jobs.module';
import type {
  createAppSchema,
  createReportSchema,
  createRequirementSchema,
  mergeRequirementSchema,
  updateAppSchema,
  updateFeedbackSchema,
  updateModelConfigSchema,
  updateRequirementSchema,
  updateUnresolvedSchema,
} from './admin.schemas';
import type { z } from 'zod';
import { StorageService } from './storage.service';

type CreateAppInput = z.infer<typeof createAppSchema>;
type UpdateAppInput = z.infer<typeof updateAppSchema>;
type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;
type MergeRequirementInput = z.infer<typeof mergeRequirementSchema>;
type CreateReportInput = z.infer<typeof createReportSchema>;
type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;
type UpdateUnresolvedInput = z.infer<typeof updateUnresolvedSchema>;
type UpdateModelInput = z.infer<typeof updateModelConfigSchema>;

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly jobs: JobsService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  listApps() {
    return this.database.client.app.findMany({
      orderBy: { createdAt: 'asc' },
      include: { authConfig: true, modelConfig: true },
    });
  }

  async createApp(auth: AuthContext, input: CreateAppInput) {
    const secret = this.crypto.randomToken(36);
    const keyId = `app_${this.crypto.randomToken(10)}`;
    const app = await this.database.client.app.create({
      data: {
        name: input.name,
        slug: input.slug,
        primaryColor: input.primaryColor,
        authConfig: {
          create: {
            allowGuest: input.allowGuest,
            allowEmail: input.allowEmail,
          },
        },
        modelConfig: { create: {} },
        credentials: {
          create: {
            name: '默认 SDK 凭证',
            keyId,
            secretHash: this.crypto.hash(secret),
            secretEncrypted: this.crypto.encrypt(secret),
          },
        },
      },
      include: { authConfig: true, modelConfig: true },
    });
    await this.audit(auth, app.id, 'app.create', 'App', app.id);
    return { app, credential: { keyId, secret } };
  }

  async updateApp(auth: AuthContext, appId: string, input: UpdateAppInput) {
    const { auth: authInput, ...appInput } = input;
    const app = await this.database.client.$transaction(async (tx) => {
      const updated = await tx.app.update({
        where: { id: appId },
        data: appInput,
      });
      if (authInput) {
        await tx.appAuthConfig.upsert({
          where: { appId },
          create: { appId, ...authInput },
          update: authInput,
        });
      }
      return updated;
    });
    await this.audit(auth, appId, 'app.update', 'App', appId);
    return app;
  }

  async createCredential(auth: AuthContext, appId: string, name: string) {
    await this.ensureApp(appId);
    const secret = this.crypto.randomToken(36);
    const credential = await this.database.client.appCredential.create({
      data: {
        appId,
        name,
        keyId: `app_${this.crypto.randomToken(10)}`,
        secretHash: this.crypto.hash(secret),
        secretEncrypted: this.crypto.encrypt(secret),
      },
    });
    await this.audit(
      auth,
      appId,
      'credential.create',
      'AppCredential',
      credential.id,
    );
    return { id: credential.id, keyId: credential.keyId, secret };
  }

  async dashboard(appId?: string) {
    const appWhere = appId ? { appId } : {};
    const [conversations, unresolved, feedback, requirements, resolved] =
      await Promise.all([
        this.database.client.conversation.count({ where: appWhere }),
        this.database.client.unresolvedCase.count({
          where: {
            status: { in: ['OPEN', 'PROCESSING'] },
            conversation: appWhere,
          },
        }),
        this.database.client.feedbackItem.count({ where: appWhere }),
        this.database.client.requirement.count({ where: appWhere }),
        this.database.client.conversation.count({
          where: { ...appWhere, status: 'RESOLVED' },
        }),
      ]);
    return {
      conversations,
      unresolved,
      feedback,
      requirements,
      resolutionRate:
        conversations === 0
          ? 0
          : Math.round((resolved / conversations) * 1000) / 10,
    };
  }

  listConversations(
    appId: string | undefined,
    status?: string,
    query?: string,
  ) {
    return this.database.client.conversation.findMany({
      where: {
        appId,
        status: status as never,
        OR: query
          ? [
              { subject: { contains: query, mode: 'insensitive' } },
              { summary: { contains: query, mode: 'insensitive' } },
              {
                messages: {
                  some: { content: { contains: query, mode: 'insensitive' } },
                },
              },
            ]
          : undefined,
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        app: { select: { id: true, name: true } },
        endUser: { select: { id: true, displayName: true } },
        unresolvedCase: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  conversationDetail(id: string, appId?: string) {
    return this.database.client.conversation.findFirst({
      where: { id, appId },
      include: {
        app: true,
        endUser: { include: { identities: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        feedbackItems: true,
        unresolvedCase: true,
      },
    });
  }

  listFeedback(appId: string | undefined, status?: string, kind?: string) {
    return this.database.client.feedbackItem.findMany({
      where: { appId, status: status as never, kind: kind as never },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        app: { select: { id: true, name: true } },
        endUser: { select: { id: true, displayName: true } },
        requirements: { include: { requirement: true } },
      },
    });
  }

  async updateFeedback(
    auth: AuthContext,
    id: string,
    appId: string | undefined,
    input: UpdateFeedbackInput,
  ) {
    const feedback = await this.database.client.feedbackItem.findFirst({
      where: { id, appId },
    });
    if (!feedback) throw new NotFoundException('反馈不存在');
    const updated = await this.database.client.feedbackItem.update({
      where: { id },
      data: input,
    });
    await this.audit(
      auth,
      feedback.appId,
      'feedback.update',
      'FeedbackItem',
      id,
    );
    return updated;
  }

  listRequirements(appId: string | undefined, status?: string) {
    return this.database.client.requirement.findMany({
      where: { appId, status: status as never },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      include: {
        app: { select: { id: true, name: true } },
        feedbackItems: { include: { feedback: true } },
      },
    });
  }

  async createRequirement(auth: AuthContext, input: CreateRequirementInput) {
    await this.ensureApp(input.appId);
    const requirement = await this.database.client.requirement.create({
      data: {
        appId: input.appId,
        title: input.title,
        summary: input.summary,
        painPoint: input.painPoint,
        proposedSolution: input.proposedSolution,
        category: input.category,
        priority: input.priority,
        source: 'MANUAL',
        feedbackItems: {
          create: input.feedbackIds.map((feedbackId) => ({ feedbackId })),
        },
      },
      include: { feedbackItems: true },
    });
    await this.audit(
      auth,
      input.appId,
      'requirement.create',
      'Requirement',
      requirement.id,
    );
    return requirement;
  }

  async updateRequirement(
    auth: AuthContext,
    id: string,
    appId: string | undefined,
    input: UpdateRequirementInput,
  ) {
    const current = await this.database.client.requirement.findFirst({
      where: { id, appId },
    });
    if (!current) throw new NotFoundException('需求不存在');
    const updated = await this.database.client.requirement.update({
      where: { id },
      data: {
        ...input,
        reviewedAt:
          input.status && input.status !== 'DRAFT' ? new Date() : undefined,
      },
    });
    await this.audit(
      auth,
      current.appId,
      'requirement.update',
      'Requirement',
      id,
    );
    return updated;
  }

  async mergeRequirements(
    auth: AuthContext,
    targetId: string,
    appId: string,
    input: MergeRequirementInput,
  ) {
    if (input.sourceIds.includes(targetId)) {
      throw new BadRequestException('目标需求不能同时作为来源需求');
    }
    const requirements = await this.database.client.requirement.findMany({
      where: { id: { in: [targetId, ...input.sourceIds] }, appId },
      include: { feedbackItems: true },
    });
    if (requirements.length !== input.sourceIds.length + 1) {
      throw new NotFoundException('部分需求不存在或不属于当前应用');
    }
    const feedbackIds = [
      ...new Set(
        requirements.flatMap((item) =>
          item.feedbackItems.map((link) => link.feedbackId),
        ),
      ),
    ];
    await this.database.client.$transaction([
      this.database.client.requirementFeedback.createMany({
        data: feedbackIds.map((feedbackId) => ({
          requirementId: targetId,
          feedbackId,
        })),
        skipDuplicates: true,
      }),
      this.database.client.requirement.update({
        where: { id: targetId },
        data: { frequency: Math.max(feedbackIds.length, 1) },
      }),
      this.database.client.requirement.updateMany({
        where: { id: { in: input.sourceIds }, appId },
        data: { status: 'REJECTED', reviewedAt: new Date() },
      }),
    ]);
    await this.audit(
      auth,
      appId,
      'requirement.merge',
      'Requirement',
      targetId,
      {
        sourceIds: input.sourceIds,
      },
    );
    return this.database.client.requirement.findUnique({
      where: { id: targetId },
      include: { feedbackItems: true },
    });
  }

  listKnowledge(appId: string) {
    return this.database.client.knowledgeSource.findMany({
      where: { appId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
    });
  }

  async createFaq(auth: AuthContext, input: CreateFaqRequest) {
    await this.ensureApp(input.appId);
    const source = await this.database.client.knowledgeSource.create({
      data: {
        appId: input.appId,
        type: 'FAQ',
        status: 'READY',
        title: input.question,
        faqQuestion: input.question,
        faqAnswer: input.answer,
        chunks: {
          create: {
            appId: input.appId,
            ordinal: 0,
            title: input.question,
            content: `${input.question}\n${input.answer}`,
          },
        },
      },
    });
    await this.jobs.add('knowledge.embed', { sourceId: source.id });
    await this.audit(
      auth,
      input.appId,
      'knowledge.create',
      'KnowledgeSource',
      source.id,
    );
    return source;
  }

  async createUrl(auth: AuthContext, input: CreateUrlSourceRequest) {
    this.assertPublicHttpUrl(input.url);
    await this.ensureApp(input.appId);
    const parsed = new URL(input.url);
    const source = await this.database.client.knowledgeSource.create({
      data: {
        appId: input.appId,
        type: 'URL',
        title: input.title ?? parsed.hostname,
        sourceUrl: input.url,
      },
    });
    await this.jobs.add('knowledge.ingest-url', { sourceId: source.id });
    await this.audit(
      auth,
      input.appId,
      'knowledge.create',
      'KnowledgeSource',
      source.id,
    );
    return source;
  }

  async createPdf(auth: AuthContext, appId: string, file: Express.Multer.File) {
    await this.ensureApp(appId);
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('仅支持 PDF 文件');
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new BadRequestException('PDF 文件不能超过 20 MB');
    }
    const objectKey = await this.storage.putPdf(appId, file.buffer);
    const source = await this.database.client.knowledgeSource.create({
      data: {
        appId,
        type: 'PDF',
        title: file.originalname,
        objectKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
    await this.jobs.add('knowledge.ingest-pdf', { sourceId: source.id });
    await this.audit(
      auth,
      appId,
      'knowledge.create',
      'KnowledgeSource',
      source.id,
    );
    return source;
  }

  async deleteKnowledge(auth: AuthContext, appId: string, id: string) {
    const source = await this.database.client.knowledgeSource.findFirst({
      where: { id, appId },
    });
    if (!source) throw new NotFoundException('知识源不存在');
    await this.database.client.knowledgeSource.delete({ where: { id } });
    if (source.objectKey) await this.storage.remove(source.objectKey);
    await this.audit(auth, appId, 'knowledge.delete', 'KnowledgeSource', id);
  }

  listReports(appId?: string) {
    return this.database.client.report.findMany({
      where: { appId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createReport(auth: AuthContext, input: CreateReportInput) {
    if (input.rangeStart >= input.rangeEnd) {
      throw new BadRequestException('报告开始时间必须早于结束时间');
    }
    if (input.appId) await this.ensureApp(input.appId);
    const report = await this.database.client.report.create({
      data: input,
    });
    await this.jobs.add('report.generate', { reportId: report.id });
    await this.audit(auth, input.appId, 'report.create', 'Report', report.id);
    return report;
  }

  reportDetail(id: string, appId?: string) {
    return this.database.client.report.findFirst({ where: { id, appId } });
  }

  listUnresolved(appId?: string) {
    return this.database.client.unresolvedCase.findMany({
      where: { conversation: { appId } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        conversation: {
          include: {
            app: { select: { id: true, name: true } },
            endUser: { select: { id: true, displayName: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
  }

  async updateUnresolved(
    auth: AuthContext,
    id: string,
    appId: string | undefined,
    input: UpdateUnresolvedInput,
  ) {
    const current = await this.database.client.unresolvedCase.findFirst({
      where: { id, conversation: { appId } },
      include: { conversation: true },
    });
    if (!current) throw new NotFoundException('待处理项不存在');
    const updated = await this.database.client.$transaction(async (tx) => {
      const item = await tx.unresolvedCase.update({
        where: { id },
        data: {
          ...input,
          resolvedAt: input.status === 'RESOLVED' ? new Date() : undefined,
        },
      });
      if (input.status === 'RESOLVED') {
        await tx.conversation.update({
          where: { id: current.conversationId },
          data: { status: 'RESOLVED', finalizedAt: new Date() },
        });
      }
      return item;
    });
    await this.audit(
      auth,
      current.conversation.appId,
      'unresolved.update',
      'UnresolvedCase',
      id,
    );
    return updated;
  }

  async modelConfig(appId: string) {
    const model = await this.database.client.appModelConfig.findUnique({
      where: { appId },
    });
    return {
      ...model,
      apiKeyConfigured: Boolean(
        model?.apiKeyEncrypted || this.config.get<string>('CHAT_API_KEY'),
      ),
      apiKeyEncrypted: undefined,
      embedding: {
        configured: Boolean(
          this.config.get<string>('EMBEDDING_API_KEY') &&
          this.config.get<string>('EMBEDDING_MODEL'),
        ),
        baseUrl: this.config.get<string>('EMBEDDING_BASE_URL') || null,
        model: this.config.get<string>('EMBEDDING_MODEL') || null,
        dimensions: this.config.get<string>('EMBEDDING_DIMENSIONS') || null,
      },
    };
  }

  async updateModelConfig(
    auth: AuthContext,
    appId: string,
    input: UpdateModelInput,
  ) {
    await this.ensureApp(appId);
    const { apiKey, ...values } = input;
    const data: Prisma.AppModelConfigUpdateInput = {
      ...values,
      apiKeyEncrypted:
        apiKey === undefined
          ? undefined
          : apiKey
            ? this.crypto.encrypt(apiKey)
            : null,
    };
    const model = await this.database.client.appModelConfig.upsert({
      where: { appId },
      create: {
        appId,
        ...values,
        apiKeyEncrypted: apiKey ? this.crypto.encrypt(apiKey) : undefined,
      },
      update: data,
    });
    await this.audit(auth, appId, 'model.update', 'AppModelConfig', model.id);
    return this.modelConfig(appId);
  }

  private async ensureApp(appId: string) {
    const app = await this.database.client.app.findUnique({
      where: { id: appId },
    });
    if (!app) throw new NotFoundException('应用不存在');
    return app;
  }

  private assertPublicHttpUrl(value: string): void {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('仅支持 HTTP/HTTPS 地址');
    }
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      throw new BadRequestException('不允许导入内网地址');
    }
  }

  private async audit(
    auth: AuthContext,
    appId: string | undefined,
    action: string,
    entityType: string,
    entityId?: string,
    metadata: Prisma.InputJsonValue = {},
  ) {
    await this.database.client.auditLog.create({
      data: {
        appId,
        adminUserId: auth.sub,
        action,
        entityType,
        entityId,
        metadata,
      },
    });
  }
}
