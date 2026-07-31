import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AgentService } from './agent.service';
import { KnowledgeRetrieverService } from './knowledge-retriever.service';

@Module({
  imports: [AuthModule],
  providers: [AgentService, KnowledgeRetrieverService],
  exports: [AgentService, KnowledgeRetrieverService],
})
export class AgentModule {}
