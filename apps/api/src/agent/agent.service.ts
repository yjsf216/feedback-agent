import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import {
  createSupportAgent,
  invokeSupportAgent,
  type AgentInput,
  type AgentOutput,
} from '@feedback-agent/agent-core';

import { CryptoService } from '../common/crypto.service';
import { DatabaseService } from '../database/database.module';
import { FallbackAgentModel, OpenAICompatibleAgentModel } from './agent-model';
import { KnowledgeRetrieverService } from './knowledge-retriever.service';

@Injectable()
export class AgentService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AgentService.name);
  private readonly checkpointer: PostgresSaver;

  constructor(
    private readonly database: DatabaseService,
    private readonly retriever: KnowledgeRetrieverService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {
    this.checkpointer = PostgresSaver.fromConnString(
      this.config.getOrThrow<string>('DATABASE_URL'),
      { schema: 'langgraph' },
    );
  }

  async onModuleInit(): Promise<void> {
    await this.checkpointer.setup();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.checkpointer.end();
  }

  async run(input: AgentInput): Promise<AgentOutput> {
    const appConfig = await this.database.client.appModelConfig.findUnique({
      where: { appId: input.appId },
    });
    const threshold = appConfig?.confidenceThreshold ?? 0.72;
    const configuredKey = appConfig?.apiKeyEncrypted
      ? this.crypto.decrypt(appConfig.apiKeyEncrypted)
      : this.config.get<string>('CHAT_API_KEY');
    const fallback = new FallbackAgentModel();
    const model =
      configuredKey && (appConfig?.enabled ?? true)
        ? new OpenAICompatibleAgentModel({
            apiKey: configuredKey,
            baseUrl:
              appConfig?.baseUrl ?? this.config.get<string>('CHAT_BASE_URL'),
            model:
              appConfig?.model ??
              this.config.get<string>('CHAT_MODEL', 'deepseek-chat'),
            temperature: appConfig?.temperature ?? 0.2,
          })
        : fallback;

    const graph = createSupportAgent({
      model,
      retriever: this.retriever,
      confidenceThreshold: threshold,
      checkpointer: this.checkpointer,
    });
    try {
      return await invokeSupportAgent(graph, input);
    } catch (error) {
      this.logger.warn(
        `Primary model failed for app ${input.appId}; using local fallback: ${String(error)}`,
      );
      const fallbackGraph = createSupportAgent({
        model: fallback,
        retriever: this.retriever,
        confidenceThreshold: threshold,
      });
      return invokeSupportAgent(fallbackGraph, input);
    }
  }
}
