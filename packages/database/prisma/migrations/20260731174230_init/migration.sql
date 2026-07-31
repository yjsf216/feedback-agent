-- Required by vector knowledge retrieval and text fallback ranking.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CredentialKind" AS ENUM ('SDK_EXCHANGE');

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('APP_SSO', 'EMAIL', 'WECHAT_OPEN', 'WECHAT_OA', 'GUEST');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WEB', 'FLUTTER');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'RESOLVED', 'UNRESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('FAQ', 'PDF', 'URL');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('BUG', 'FEATURE_REQUEST', 'COMPLAINT', 'PRAISE', 'QUESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'LINKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'APPROVED', 'PLANNED', 'IN_PROGRESS', 'DONE', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequirementSource" AS ENUM ('AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "UnresolvedStatus" AS ENUM ('OPEN', 'PROCESSING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "App" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "AppStatus" NOT NULL DEFAULT 'ACTIVE',
    "primaryColor" VARCHAR(32) NOT NULL DEFAULT '#0F766E',
    "welcomeMessageZh" TEXT NOT NULL DEFAULT '你好，我会尽力解答问题，也会认真记录你的反馈。',
    "welcomeMessageEn" TEXT NOT NULL DEFAULT 'Hi, I can answer product questions and carefully capture your feedback.',
    "suggestedQuestionsZh" JSONB NOT NULL DEFAULT '[]',
    "suggestedQuestionsEn" JSONB NOT NULL DEFAULT '[]',
    "publicWidgetEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppCredential" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "kind" "CredentialKind" NOT NULL DEFAULT 'SDK_EXCHANGE',
    "name" VARCHAR(120) NOT NULL,
    "keyId" VARCHAR(80) NOT NULL,
    "secretHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppAuthConfig" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "allowGuest" BOOLEAN NOT NULL DEFAULT true,
    "allowEmail" BOOLEAN NOT NULL DEFAULT false,
    "allowWechat" BOOLEAN NOT NULL DEFAULT false,
    "wechatAppId" VARCHAR(120),
    "wechatSecret" TEXT,
    "wechatMode" VARCHAR(40),

    CONSTRAINT "AppAuthConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppModelConfig" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "provider" VARCHAR(80) NOT NULL DEFAULT 'deepseek',
    "baseUrl" TEXT,
    "model" VARCHAR(120) NOT NULL DEFAULT 'deepseek-chat',
    "apiKeyEncrypted" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.72,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndUser" (
    "id" UUID NOT NULL,
    "displayName" VARCHAR(120),
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" UUID NOT NULL,
    "endUserId" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "type" "IdentityType" NOT NULL,
    "issuer" VARCHAR(120) NOT NULL DEFAULT 'feedback-agent',
    "subject" VARCHAR(320) NOT NULL,
    "email" VARCHAR(320),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "endUserId" UUID,
    "adminUserId" UUID,
    "appId" UUID,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "endUserId" UUID NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "locale" VARCHAR(12) NOT NULL DEFAULT 'zh-CN',
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "subject" VARCHAR(240),
    "summary" TEXT,
    "resolutionNote" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "aiConfidence" DOUBLE PRECISION,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "clientMessageId" VARCHAR(100),
    "role" "MessageRole" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'COMPLETED',
    "content" TEXT NOT NULL,
    "intent" VARCHAR(80),
    "citations" JSONB NOT NULL DEFAULT '[]',
    "model" VARCHAR(120),
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "errorCode" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "title" VARCHAR(240) NOT NULL,
    "sourceUrl" TEXT,
    "objectKey" TEXT,
    "mimeType" VARCHAR(120),
    "sizeBytes" INTEGER,
    "faqQuestion" TEXT,
    "faqAnswer" TEXT,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "embedding" vector,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackItem" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "messageId" UUID,
    "endUserId" UUID NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT NOT NULL,
    "painPoint" TEXT,
    "severity" INTEGER NOT NULL DEFAULT 2,
    "sentiment" DOUBLE PRECISION,
    "aiConfidence" DOUBLE PRECISION,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "summary" TEXT NOT NULL,
    "painPoint" TEXT NOT NULL,
    "proposedSolution" TEXT,
    "category" VARCHAR(120),
    "priority" INTEGER NOT NULL DEFAULT 2,
    "impactScore" DOUBLE PRECISION,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "RequirementSource" NOT NULL DEFAULT 'AI',
    "aiConfidence" DOUBLE PRECISION,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementFeedback" (
    "requirementId" UUID NOT NULL,
    "feedbackId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementFeedback_pkey" PRIMARY KEY ("requirementId","feedbackId")
);

-- CreateTable
CREATE TABLE "UnresolvedCase" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "status" "UnresolvedStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnresolvedCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "appId" UUID,
    "name" VARCHAR(240) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "rangeStart" TIMESTAMP(3) NOT NULL,
    "rangeEnd" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "markdown" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "conversationId" UUID,
    "provider" VARCHAR(80) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(18,8),
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "appId" UUID,
    "adminUserId" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entityType" VARCHAR(120) NOT NULL,
    "entityId" VARCHAR(120),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "App_slug_key" ON "App"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AppCredential_keyId_key" ON "AppCredential"("keyId");

-- CreateIndex
CREATE INDEX "AppCredential_appId_kind_idx" ON "AppCredential"("appId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AppAuthConfig_appId_key" ON "AppAuthConfig"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "AppModelConfig_appId_key" ON "AppModelConfig"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "UserIdentity_endUserId_idx" ON "UserIdentity"("endUserId");

-- CreateIndex
CREATE INDEX "UserIdentity_email_idx" ON "UserIdentity"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_appId_type_issuer_subject_key" ON "UserIdentity"("appId", "type", "issuer", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_endUserId_expiresAt_idx" ON "AuthSession"("endUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_adminUserId_expiresAt_idx" ON "AuthSession"("adminUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "Conversation_appId_status_lastMessageAt_idx" ON "Conversation"("appId", "status", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "Conversation_endUserId_lastMessageAt_idx" ON "Conversation"("endUserId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_clientMessageId_key" ON "Message"("conversationId", "clientMessageId");

-- CreateIndex
CREATE INDEX "KnowledgeSource_appId_status_updatedAt_idx" ON "KnowledgeSource"("appId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "KnowledgeChunk_appId_createdAt_idx" ON "KnowledgeChunk"("appId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_sourceId_ordinal_key" ON "KnowledgeChunk"("sourceId", "ordinal");

-- CreateIndex
CREATE INDEX "FeedbackItem_appId_status_createdAt_idx" ON "FeedbackItem"("appId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FeedbackItem_conversationId_idx" ON "FeedbackItem"("conversationId");

-- CreateIndex
CREATE INDEX "Requirement_appId_status_priority_updatedAt_idx" ON "Requirement"("appId", "status", "priority", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UnresolvedCase_conversationId_key" ON "UnresolvedCase"("conversationId");

-- CreateIndex
CREATE INDEX "UnresolvedCase_status_priority_createdAt_idx" ON "UnresolvedCase"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "Report_appId_createdAt_idx" ON "Report"("appId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UsageRecord_appId_createdAt_idx" ON "UsageRecord"("appId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_appId_createdAt_idx" ON "AuditLog"("appId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_adminUserId_createdAt_idx" ON "AuditLog"("adminUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AppCredential" ADD CONSTRAINT "AppCredential_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppAuthConfig" ADD CONSTRAINT "AppAuthConfig_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppModelConfig" ADD CONSTRAINT "AppModelConfig_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementFeedback" ADD CONSTRAINT "RequirementFeedback_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementFeedback" ADD CONSTRAINT "RequirementFeedback_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "FeedbackItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnresolvedCase" ADD CONSTRAINT "UnresolvedCase_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
