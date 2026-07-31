export interface KnowledgeHit {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  url?: string;
  score: number;
}

export interface AgentInput {
  appId: string;
  conversationId: string;
  locale: "zh-CN" | "en";
  message: string;
}

export interface AgentOutput {
  answer: string;
  intent: string;
  confidence: number;
  unresolved: boolean;
  sources: KnowledgeHit[];
}

export interface KnowledgeRetriever {
  search(input: {
    appId: string;
    query: string;
    limit: number;
  }): Promise<KnowledgeHit[]>;
}

export interface AgentModel {
  classify(input: AgentInput): Promise<{ intent: string; safe: boolean }>;
  answer(input: AgentInput & { knowledge: KnowledgeHit[] }): Promise<{
    answer: string;
    confidence: number;
  }>;
}

export * from "./support-agent";
