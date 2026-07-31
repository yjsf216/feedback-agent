import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  createFaqRequestSchema,
  createUrlSourceRequestSchema,
} from '@feedback-agent/contracts';
import { z } from 'zod';

import { AdminAuthGuard, CurrentAuth, type AuthContext } from '../common/auth';
import { optionalAppScope, parseBody, requiredAppScope } from '../common/parse';
import {
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
import { AdminService } from './admin.service';

const credentialSchema = z.object({
  name: z.string().trim().min(2).max(120).default('SDK 凭证'),
});

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/apps')
export class AdminAppsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list() {
    return this.admin.listApps();
  }

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return this.admin.createApp(auth, parseBody(createAppSchema, body));
  }

  @Patch(':id')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.admin.updateApp(auth, id, parseBody(updateAppSchema, body));
  }

  @Post(':id/credentials')
  credential(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(credentialSchema, body);
    return this.admin.createCredential(auth, id, input.name);
  }

  @Get(':id/model')
  model(@Param('id') id: string) {
    return this.admin.modelConfig(id);
  }

  @Patch(':id/model')
  updateModel(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.admin.updateModelConfig(
      auth,
      id,
      parseBody(updateModelConfigSchema, body),
    );
  }
}

@UseGuards(AdminAuthGuard)
@Controller('v1/admin')
export class AdminInboxController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard(@Headers('x-app-id') appHeader?: string) {
    return this.admin.dashboard(optionalAppScope(appHeader));
  }

  @Get('conversations')
  conversations(
    @Headers('x-app-id') appHeader?: string,
    @Query('status') status?: string,
    @Query('query') query?: string,
  ) {
    return this.admin.listConversations(
      optionalAppScope(appHeader),
      status,
      query,
    );
  }

  @Get('conversations/:id')
  conversation(
    @Param('id') id: string,
    @Headers('x-app-id') appHeader?: string,
  ) {
    return this.admin.conversationDetail(id, optionalAppScope(appHeader));
  }

  @Get('feedback')
  feedback(
    @Headers('x-app-id') appHeader?: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
  ) {
    return this.admin.listFeedback(optionalAppScope(appHeader), status, kind);
  }

  @Patch('feedback/:id')
  updateFeedback(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Headers('x-app-id') appHeader: string | undefined,
    @Body() body: unknown,
  ) {
    return this.admin.updateFeedback(
      auth,
      id,
      optionalAppScope(appHeader),
      parseBody(updateFeedbackSchema, body),
    );
  }

  @Get('requirements')
  requirements(
    @Headers('x-app-id') appHeader?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listRequirements(optionalAppScope(appHeader), status);
  }

  @Post('requirements')
  createRequirement(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-app-id') appHeader: string | undefined,
    @Body() body: unknown,
  ) {
    const appId = requiredAppScope(appHeader);
    const input = parseBody(createRequirementSchema, body);
    if (input.appId !== appId) {
      throw new BadRequestException('请求应用与当前选择的应用不一致');
    }
    return this.admin.createRequirement(auth, input);
  }

  @Patch('requirements/:id')
  updateRequirement(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Headers('x-app-id') appHeader: string | undefined,
    @Body() body: unknown,
  ) {
    return this.admin.updateRequirement(
      auth,
      id,
      optionalAppScope(appHeader),
      parseBody(updateRequirementSchema, body),
    );
  }

  @Post('requirements/:id/merge')
  mergeRequirements(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Headers('x-app-id') appHeader: string | undefined,
    @Body() body: unknown,
  ) {
    return this.admin.mergeRequirements(
      auth,
      id,
      requiredAppScope(appHeader),
      parseBody(mergeRequirementSchema, body),
    );
  }

  @Get('unresolved')
  unresolved(@Headers('x-app-id') appHeader?: string) {
    return this.admin.listUnresolved(optionalAppScope(appHeader));
  }

  @Patch('unresolved/:id')
  updateUnresolved(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Headers('x-app-id') appHeader: string | undefined,
    @Body() body: unknown,
  ) {
    return this.admin.updateUnresolved(
      auth,
      id,
      optionalAppScope(appHeader),
      parseBody(updateUnresolvedSchema, body),
    );
  }
}

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/knowledge')
export class AdminKnowledgeController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(@Headers('x-app-id') appHeader?: string) {
    return this.admin.listKnowledge(requiredAppScope(appHeader));
  }

  @Post('faq')
  createFaq(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-app-id') appHeader: string | undefined,
    @Body() body: unknown,
  ) {
    const appId = requiredAppScope(appHeader);
    const input = parseBody(createFaqRequestSchema, body);
    if (input.appId !== appId) {
      throw new BadRequestException('请求应用与当前选择的应用不一致');
    }
    return this.admin.createFaq(auth, input);
  }

  @Post('url')
  createUrl(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-app-id') appHeader: string | undefined,
    @Body() body: unknown,
  ) {
    const appId = requiredAppScope(appHeader);
    const input = parseBody(createUrlSourceRequestSchema, body);
    if (input.appId !== appId) {
      throw new BadRequestException('请求应用与当前选择的应用不一致');
    }
    return this.admin.createUrl(auth, input);
  }

  @Post('pdf')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  createPdf(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-app-id') appHeader: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('请选择 PDF 文件');
    return this.admin.createPdf(auth, requiredAppScope(appHeader), file);
  }

  @HttpCode(204)
  @Delete(':id')
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-app-id') appHeader: string | undefined,
    @Param('id') id: string,
  ) {
    await this.admin.deleteKnowledge(auth, requiredAppScope(appHeader), id);
  }
}

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/reports')
export class AdminReportsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(@Headers('x-app-id') appHeader?: string) {
    return this.admin.listReports(optionalAppScope(appHeader));
  }

  @Post()
  create(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-app-id') appHeader: string | undefined,
    @Body() body: unknown,
  ) {
    const scope = optionalAppScope(appHeader);
    const input = parseBody(createReportSchema, body);
    if (scope && input.appId && scope !== input.appId) {
      throw new BadRequestException('请求应用与当前选择的应用不一致');
    }
    return this.admin.createReport(auth, {
      ...input,
      appId: scope ?? input.appId,
    });
  }

  @Get(':id')
  detail(@Param('id') id: string, @Headers('x-app-id') appHeader?: string) {
    return this.admin.reportDetail(id, optionalAppScope(appHeader));
  }
}
