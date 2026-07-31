import { z } from 'zod';

export const createAppSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#0F766E'),
  allowGuest: z.boolean().default(true),
  allowEmail: z.boolean().default(false),
});

export const updateAppSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  publicWidgetEnabled: z.boolean().optional(),
  welcomeMessageZh: z.string().trim().min(2).max(2000).optional(),
  welcomeMessageEn: z.string().trim().min(2).max(2000).optional(),
  suggestedQuestionsZh: z.array(z.string().min(1).max(200)).max(8).optional(),
  suggestedQuestionsEn: z.array(z.string().min(1).max(200)).max(8).optional(),
  auth: z
    .object({
      allowGuest: z.boolean().optional(),
      allowEmail: z.boolean().optional(),
      allowWechat: z.boolean().optional(),
      wechatAppId: z.string().max(120).nullable().optional(),
      wechatSecret: z.string().max(300).nullable().optional(),
      wechatMode: z.enum(['OPEN', 'OA']).nullable().optional(),
    })
    .optional(),
});

export const updateFeedbackSchema = z.object({
  status: z.enum(['NEW', 'REVIEWED', 'LINKED', 'ARCHIVED']),
});

export const createRequirementSchema = z.object({
  appId: z.string().uuid(),
  title: z.string().trim().min(2).max(240),
  summary: z.string().trim().min(2).max(5000),
  painPoint: z.string().trim().min(2).max(5000),
  proposedSolution: z.string().trim().max(5000).optional(),
  category: z.string().trim().max(120).optional(),
  priority: z.number().int().min(1).max(4).default(2),
  feedbackIds: z.array(z.string().uuid()).max(200).default([]),
});

export const updateRequirementSchema = z.object({
  title: z.string().trim().min(2).max(240).optional(),
  summary: z.string().trim().min(2).max(5000).optional(),
  painPoint: z.string().trim().min(2).max(5000).optional(),
  proposedSolution: z.string().trim().max(5000).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  status: z
    .enum(['DRAFT', 'APPROVED', 'PLANNED', 'IN_PROGRESS', 'DONE', 'REJECTED'])
    .optional(),
});

export const mergeRequirementSchema = z.object({
  sourceIds: z.array(z.string().uuid()).min(1).max(50),
});

export const createReportSchema = z.object({
  appId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(240),
  rangeStart: z.coerce.date(),
  rangeEnd: z.coerce.date(),
});

export const updateUnresolvedSchema = z.object({
  status: z.enum(['OPEN', 'PROCESSING', 'RESOLVED', 'DISMISSED']),
  resolution: z.string().trim().max(5000).optional(),
  priority: z.number().int().min(1).max(4).optional(),
});

export const updateModelConfigSchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  baseUrl: z.string().url().nullable().optional(),
  model: z.string().trim().min(1).max(120).optional(),
  apiKey: z.string().max(500).nullable().optional(),
  temperature: z.number().min(0).max(2).optional(),
  confidenceThreshold: z.number().min(0.3).max(0.99).optional(),
  enabled: z.boolean().optional(),
});
