import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { DatabaseService } from '../database/database.module';

@Controller('v1/public/apps')
export class PublicAppsController {
  constructor(private readonly database: DatabaseService) {}

  @Get(':slug/config')
  async config(@Param('slug') slug: string) {
    const app = await this.database.client.app.findFirst({
      where: { slug, status: 'ACTIVE', publicWidgetEnabled: true },
      include: { authConfig: true },
    });
    if (!app) throw new NotFoundException('应用不存在或未开放反馈入口');

    const auth = app.authConfig;
    return {
      id: app.id,
      slug: app.slug,
      name: app.name,
      primaryColor: app.primaryColor,
      welcomeMessages: {
        'zh-CN': app.welcomeMessageZh,
        en: app.welcomeMessageEn,
      },
      suggestedQuestions: {
        'zh-CN': app.suggestedQuestionsZh,
        en: app.suggestedQuestionsEn,
      },
      auth: {
        guest: auth?.allowGuest ?? false,
        email: auth?.allowEmail ?? false,
        wechat:
          Boolean(auth?.allowWechat) &&
          Boolean(auth?.wechatAppId) &&
          Boolean(auth?.wechatSecret),
      },
    };
  }
}
