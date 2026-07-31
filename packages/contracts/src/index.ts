import { z } from "zod";

export const appLocaleSchema = z.enum(["zh-CN", "en"]);
export type AppLocale = z.infer<typeof appLocaleSchema>;

export const conversationChannelSchema = z.enum(["WEB", "FLUTTER"]);
export type ConversationChannel = z.infer<typeof conversationChannelSchema>;

export const conversationStatusSchema = z.enum([
  "OPEN",
  "RESOLVED",
  "UNRESOLVED",
  "CLOSED",
]);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export const intentSchema = z.enum([
  "QUESTION",
  "BUG",
  "FEATURE_REQUEST",
  "COMPLAINT",
  "PRAISE",
  "OTHER",
]);
export type Intent = z.infer<typeof intentSchema>;

export const feedbackKindSchema = z.enum([
  "BUG",
  "FEATURE_REQUEST",
  "COMPLAINT",
  "PRAISE",
  "QUESTION",
  "OTHER",
]);
export type FeedbackKind = z.infer<typeof feedbackKindSchema>;

export const requirementStatusSchema = z.enum([
  "DRAFT",
  "APPROVED",
  "PLANNED",
  "IN_PROGRESS",
  "DONE",
  "REJECTED",
]);
export type RequirementStatus = z.infer<typeof requirementStatusSchema>;

export const exchangeTokenRequestSchema = z.object({
  appId: z.string().uuid(),
  keyId: z.string().min(8).max(80),
  externalUserId: z.string().min(1).max(200),
  displayName: z.string().trim().min(1).max(120).optional(),
  email: z.string().email().optional(),
  timestamp: z.number().int().positive(),
  nonce: z.string().min(12).max(200),
  signature: z.string().min(32).max(512),
});
export type ExchangeTokenRequest = z.infer<typeof exchangeTokenRequestSchema>;

export const createGuestRequestSchema = z.object({
  appId: z.string().uuid(),
  guestId: z.string().min(8).max(200),
});
export type CreateGuestRequest = z.infer<typeof createGuestRequestSchema>;

export const emailRegisterRequestSchema = z.object({
  appId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(120).optional(),
});
export type EmailRegisterRequest = z.infer<typeof emailRegisterRequestSchema>;

export const emailLoginRequestSchema = z.object({
  appId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type EmailLoginRequest = z.infer<typeof emailLoginRequestSchema>;

export const createConversationRequestSchema = z.object({
  appId: z.string().uuid(),
  channel: conversationChannelSchema,
  locale: appLocaleSchema.default("zh-CN"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateConversationRequest = z.infer<
  typeof createConversationRequestSchema
>;

export const sendMessageRequestSchema = z.object({
  content: z.string().trim().min(1).max(8000),
  clientMessageId: z.string().min(8).max(100),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const resolutionRequestSchema = z.object({
  resolved: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
});
export type ResolutionRequest = z.infer<typeof resolutionRequestSchema>;

export const publicAppConfigSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  primaryColor: z.string(),
  welcomeMessage: z.string(),
  suggestedQuestions: z.array(z.string()),
  auth: z.object({
    guest: z.boolean(),
    email: z.boolean(),
    wechat: z.boolean(),
  }),
});
export type PublicAppConfig = z.infer<typeof publicAppConfigSchema>;

const baseStreamEventSchema = z.object({
  conversationId: z.string().uuid(),
  eventId: z.string(),
  createdAt: z.string().datetime(),
});

export const streamEventSchema = z.discriminatedUnion("type", [
  baseStreamEventSchema.extend({ type: z.literal("message.start") }),
  baseStreamEventSchema.extend({
    type: z.literal("message.delta"),
    delta: z.string(),
  }),
  baseStreamEventSchema.extend({
    type: z.literal("knowledge.source"),
    source: z.object({
      id: z.string(),
      title: z.string(),
      url: z.string().optional(),
    }),
  }),
  baseStreamEventSchema.extend({
    type: z.literal("conversation.state"),
    status: conversationStatusSchema,
  }),
  baseStreamEventSchema.extend({
    type: z.literal("message.completed"),
    messageId: z.string().uuid(),
    content: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  baseStreamEventSchema.extend({
    type: z.literal("error"),
    code: z.string(),
    message: z.string(),
  }),
]);
export type StreamEvent = z.infer<typeof streamEventSchema>;

export interface AccessTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    displayName: string | null;
  };
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export const createFaqRequestSchema = z.object({
  appId: z.string().uuid(),
  question: z.string().trim().min(2).max(500),
  answer: z.string().trim().min(2).max(12000),
});
export type CreateFaqRequest = z.infer<typeof createFaqRequestSchema>;

export const createUrlSourceRequestSchema = z.object({
  appId: z.string().uuid(),
  url: z.string().url(),
  title: z.string().trim().min(1).max(240).optional(),
});
export type CreateUrlSourceRequest = z.infer<
  typeof createUrlSourceRequestSchema
>;
