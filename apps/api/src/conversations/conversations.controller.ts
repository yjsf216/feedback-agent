import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  createConversationRequestSchema,
  resolutionRequestSchema,
  sendMessageRequestSchema,
} from '@feedback-agent/contracts';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

import { CurrentAuth, type AuthContext, UserAuthGuard } from '../common/auth';
import { optionalAppScope, parseBody } from '../common/parse';
import { ConversationsService } from './conversations.service';

@UseGuards(UserAuthGuard)
@Controller('v1/conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return this.conversations.create(
      auth,
      parseBody(createConversationRequestSchema, body),
    );
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query('appId') appId?: string) {
    return this.conversations.list(auth, optionalAppScope(appId));
  }

  @Get(':id')
  detail(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.conversations.detail(auth, id);
  }

  @Post(':id/messages:stream')
  async stream(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    const emit = (type: string, payload: Record<string, unknown> = {}) => {
      const eventId = randomUUID();
      response.write(`id: ${eventId}\n`);
      response.write(`event: ${type}\n`);
      response.write(
        `data: ${JSON.stringify({ type, conversationId: id, eventId, createdAt: new Date().toISOString(), ...payload })}\n\n`,
      );
    };

    emit('message.start');
    try {
      const result = await this.conversations.sendMessage(
        auth,
        id,
        parseBody(sendMessageRequestSchema, body),
      );
      for (const source of result.sources) {
        emit('knowledge.source', { source });
      }
      for (const delta of result.content.match(/[\s\S]{1,28}/g) ?? []) {
        emit('message.delta', { delta });
      }
      emit('conversation.state', { status: result.status });
      emit('message.completed', {
        messageId: result.messageId,
        content: result.content,
        confidence: result.confidence,
      });
    } catch (error) {
      emit('error', {
        code: 'MESSAGE_FAILED',
        message: error instanceof Error ? error.message : '消息处理失败',
      });
    } finally {
      response.end();
    }
  }

  @HttpCode(200)
  @Post(':id/resolution')
  resolution(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.conversations.setResolution(
      auth,
      id,
      parseBody(resolutionRequestSchema, body),
    );
  }

  @HttpCode(200)
  @Post(':id/close')
  @Header('Cache-Control', 'no-store')
  close(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.conversations.close(auth, id);
  }
}
