import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type {
  AgentInput,
  AgentModel,
  AgentOutput,
  KnowledgeHit,
  KnowledgeRetriever,
} from "./index";

const SupportState = Annotation.Root({
  input: Annotation<AgentInput>(),
  safe: Annotation<boolean>(),
  intent: Annotation<string>(),
  knowledge: Annotation<KnowledgeHit[]>({
    reducer: (_, value) => value,
    default: () => [],
  }),
  answer: Annotation<string>(),
  confidence: Annotation<number>(),
  unresolved: Annotation<boolean>(),
});

export interface SupportAgentDependencies {
  model: AgentModel;
  retriever: KnowledgeRetriever;
  confidenceThreshold?: number;
}

export function createSupportAgent(dependencies: SupportAgentDependencies) {
  const threshold = dependencies.confidenceThreshold ?? 0.72;

  return new StateGraph(SupportState)
    .addNode("classify", async ({ input }) => {
      const result = await dependencies.model.classify(input);
      return { intent: result.intent, safe: result.safe };
    })
    .addNode("retrieve", async ({ input }) => ({
      knowledge: await dependencies.retriever.search({
        appId: input.appId,
        query: input.message,
        limit: 5,
      }),
    }))
    .addNode("answer", async ({ input, knowledge, safe }) => {
      if (!safe) {
        return {
          answer:
            input.locale === "en"
              ? "I cannot help with that request, but I can help with product questions or feedback."
              : "这个请求我无法处理，但我可以继续帮助你解答产品问题或记录反馈。",
          confidence: 1,
          unresolved: false,
        };
      }

      const result = await dependencies.model.answer({ ...input, knowledge });
      return {
        answer: result.answer,
        confidence: result.confidence,
        unresolved: result.confidence < threshold,
      };
    })
    .addEdge(START, "classify")
    .addEdge("classify", "retrieve")
    .addEdge("retrieve", "answer")
    .addEdge("answer", END)
    .compile();
}

export async function invokeSupportAgent(
  agent: ReturnType<typeof createSupportAgent>,
  input: AgentInput,
): Promise<AgentOutput> {
  const result = await agent.invoke({ input });
  return {
    answer: result.answer,
    confidence: result.confidence,
    intent: result.intent,
    knowledge: result.knowledge,
    sources: result.knowledge,
    unresolved: result.unresolved,
  } as AgentOutput & { knowledge: KnowledgeHit[] };
}
