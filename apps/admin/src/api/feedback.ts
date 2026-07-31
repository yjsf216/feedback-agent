import { http } from "@/utils/http";

export type AppSummary = {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "DISABLED";
  primaryColor: string;
  publicWidgetEnabled: boolean;
  welcomeMessageZh?: string;
  welcomeMessageEn?: string;
  authConfig?: {
    allowGuest: boolean;
    allowEmail: boolean;
    allowWechat: boolean;
  };
};

export type ModelConfig = {
  id: string;
  appId: string;
  provider: string;
  baseUrl: string | null;
  model: string;
  temperature: number;
  confidenceThreshold: number;
  enabled: boolean;
  apiKeyConfigured: boolean;
  embedding: {
    configured: boolean;
    baseUrl: string | null;
    model: string | null;
    dimensions: string | null;
  };
};

export type DashboardMetrics = {
  conversations: number;
  unresolved: number;
  feedback: number;
  requirements: number;
  resolutionRate: number;
};

export type Conversation = {
  id: string;
  subject: string | null;
  status: string;
  locale: string;
  aiConfidence: number | null;
  lastMessageAt: string;
  app: { id: string; name: string };
  endUser: { id: string; displayName: string | null };
  messages: Message[];
  unresolvedCase?: UnresolvedCase | null;
};

export type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
  citations?: Array<{ id: string; title: string; url?: string }>;
};

export type FeedbackItem = {
  id: string;
  kind: string;
  status: string;
  title: string;
  description: string;
  painPoint: string | null;
  severity: number;
  aiConfidence: number | null;
  createdAt: string;
  app: { id: string; name: string };
  endUser: { id: string; displayName: string | null };
};

export type Requirement = {
  id: string;
  title: string;
  summary: string;
  painPoint: string;
  proposedSolution: string | null;
  category: string | null;
  priority: number;
  frequency: number;
  status: string;
  source: string;
  aiConfidence: number | null;
  updatedAt: string;
  app: { id: string; name: string };
  feedbackItems: Array<{ feedback: FeedbackItem }>;
};

export type UnresolvedCase = {
  id: string;
  status: string;
  priority: number;
  reason: string;
  resolution: string | null;
  createdAt: string;
  conversation: Conversation;
};

export type KnowledgeSource = {
  id: string;
  type: "FAQ" | "PDF" | "URL";
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  title: string;
  sourceUrl: string | null;
  sizeBytes: number | null;
  error: string | null;
  updatedAt: string;
  _count: { chunks: number };
};

export type Report = {
  id: string;
  name: string;
  status: "PENDING" | "GENERATING" | "READY" | "FAILED";
  rangeStart: string;
  rangeEnd: string;
  metrics: Record<string, unknown>;
  markdown: string | null;
  error: string | null;
  createdAt: string;
};

export const api = {
  apps: {
    list: () => http.request<AppSummary[]>("get", "/v1/admin/apps"),
    create: (data: object) =>
      http.request<{
        app: AppSummary;
        credential: { keyId: string; secret: string };
      }>("post", "/v1/admin/apps", { data }),
    update: (id: string, data: object) =>
      http.request<AppSummary>("patch", `/v1/admin/apps/${id}`, { data }),
    credential: (id: string, name = "SDK 凭证") =>
      http.request<{ id: string; keyId: string; secret: string }>(
        "post",
        `/v1/admin/apps/${id}/credentials`,
        { data: { name } }
      ),
    model: (id: string) =>
      http.request<ModelConfig>("get", `/v1/admin/apps/${id}/model`),
    updateModel: (id: string, data: object) =>
      http.request<ModelConfig>("patch", `/v1/admin/apps/${id}/model`, {
        data
      })
  },
  dashboard: () => http.request<DashboardMetrics>("get", "/v1/admin/dashboard"),
  conversations: {
    list: (params?: object) =>
      http.request<Conversation[]>("get", "/v1/admin/conversations", {
        params
      }),
    detail: (id: string) =>
      http.request<Conversation>("get", `/v1/admin/conversations/${id}`)
  },
  feedback: {
    list: (params?: object) =>
      http.request<FeedbackItem[]>("get", "/v1/admin/feedback", { params }),
    update: (id: string, data: object) =>
      http.request<FeedbackItem>("patch", `/v1/admin/feedback/${id}`, { data })
  },
  requirements: {
    list: (params?: object) =>
      http.request<Requirement[]>("get", "/v1/admin/requirements", { params }),
    update: (id: string, data: object) =>
      http.request<Requirement>("patch", `/v1/admin/requirements/${id}`, {
        data
      }),
    merge: (id: string, sourceIds: string[]) =>
      http.request<Requirement>("post", `/v1/admin/requirements/${id}/merge`, {
        data: { sourceIds }
      })
  },
  unresolved: {
    list: () => http.request<UnresolvedCase[]>("get", "/v1/admin/unresolved"),
    update: (id: string, data: object) =>
      http.request<UnresolvedCase>("patch", `/v1/admin/unresolved/${id}`, {
        data
      })
  },
  knowledge: {
    list: () => http.request<KnowledgeSource[]>("get", "/v1/admin/knowledge"),
    faq: (data: object) =>
      http.request<KnowledgeSource>("post", "/v1/admin/knowledge/faq", {
        data
      }),
    url: (data: object) =>
      http.request<KnowledgeSource>("post", "/v1/admin/knowledge/url", {
        data
      }),
    pdf: (data: FormData) =>
      http.request<KnowledgeSource>("post", "/v1/admin/knowledge/pdf", {
        data
      }),
    remove: (id: string) =>
      http.request<void>("delete", `/v1/admin/knowledge/${id}`)
  },
  reports: {
    list: () => http.request<Report[]>("get", "/v1/admin/reports"),
    create: (data: object) =>
      http.request<Report>("post", "/v1/admin/reports", { data }),
    detail: (id: string) =>
      http.request<Report>("get", `/v1/admin/reports/${id}`)
  }
};
