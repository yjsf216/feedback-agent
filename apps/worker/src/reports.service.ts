import { Injectable } from '@nestjs/common';
import { Prisma } from '@feedback-agent/database';

import { DatabaseService } from './database.service';

@Injectable()
export class ReportsService {
  constructor(private readonly database: DatabaseService) {}

  async generate(reportId: string): Promise<void> {
    const report = await this.database.client.report.findUnique({
      where: { id: reportId },
      include: { app: true },
    });
    if (!report) throw new Error(`Report ${reportId} was not found`);
    await this.database.client.report.update({
      where: { id: reportId },
      data: { status: 'GENERATING', error: null },
    });
    const range = { gte: report.rangeStart, lte: report.rangeEnd };
    const appWhere = report.appId ? { appId: report.appId } : {};
    const [
      conversationCount,
      resolvedCount,
      unresolvedCount,
      feedbackByKind,
      topRequirements,
      confidence,
    ] = await Promise.all([
      this.database.client.conversation.count({
        where: { ...appWhere, createdAt: range },
      }),
      this.database.client.conversation.count({
        where: { ...appWhere, createdAt: range, status: 'RESOLVED' },
      }),
      this.database.client.unresolvedCase.count({
        where: {
          createdAt: range,
          conversation: report.appId ? { appId: report.appId } : {},
        },
      }),
      this.database.client.feedbackItem.groupBy({
        by: ['kind'],
        where: { ...appWhere, createdAt: range },
        _count: { _all: true },
        orderBy: { _count: { kind: 'desc' } },
      }),
      this.database.client.requirement.findMany({
        where: { ...appWhere, createdAt: range },
        orderBy: [{ frequency: 'desc' }, { priority: 'desc' }],
        take: 10,
      }),
      this.database.client.conversation.aggregate({
        where: { ...appWhere, createdAt: range, aiConfidence: { not: null } },
        _avg: { aiConfidence: true },
      }),
    ]);
    const resolutionRate =
      conversationCount === 0
        ? 0
        : Math.round((resolvedCount / conversationCount) * 1000) / 10;
    const averageConfidence = confidence._avg.aiConfidence ?? 0;
    const metrics: Prisma.InputJsonObject = {
      conversations: conversationCount,
      resolved: resolvedCount,
      unresolved: unresolvedCount,
      resolutionRate,
      averageConfidence,
      feedbackByKind: feedbackByKind.map((item) => ({
        kind: item.kind,
        count: item._count._all,
      })),
      topRequirements: topRequirements.map((item) => ({
        id: item.id,
        title: item.title,
        frequency: item.frequency,
        priority: item.priority,
        status: item.status,
      })),
    };
    const lines = [
      `# ${report.name}`,
      '',
      `应用：${report.app?.name ?? '全部应用'}`,
      `统计区间：${report.rangeStart.toISOString()} — ${report.rangeEnd.toISOString()}`,
      '',
      '## 核心指标',
      '',
      `- 对话数：${conversationCount}`,
      `- 已解决：${resolvedCount}`,
      `- 未解决队列：${unresolvedCount}`,
      `- 自动解决率：${resolutionRate}%`,
      `- 平均置信度：${Math.round(averageConfidence * 100)}%`,
      '',
      '## 反馈分布',
      '',
      ...feedbackByKind.map((item) => `- ${item.kind}：${item._count._all}`),
      '',
      '## 高频需求草稿',
      '',
      ...(topRequirements.length
        ? topRequirements.map(
            (item, index) =>
              `${index + 1}. ${item.title}（频次 ${item.frequency}，优先级 P${item.priority}，${item.status}）`,
          )
        : ['暂无需求草稿。']),
      '',
      '> 所有 AI 生成需求均为草稿，需由管理员确认、合并或拒绝。',
    ];
    await this.database.client.report.update({
      where: { id: reportId },
      data: {
        status: 'READY',
        metrics,
        markdown: lines.join('\n'),
        completedAt: new Date(),
      },
    });
  }

  async markFailed(reportId: string, error: unknown): Promise<void> {
    await this.database.client.report.updateMany({
      where: { id: reportId },
      data: {
        status: 'FAILED',
        error:
          error instanceof Error ? error.message.slice(0, 4000) : String(error),
      },
    });
  }
}
