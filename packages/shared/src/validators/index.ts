import { z } from 'zod';

export const languageSchema = z.enum(['kk', 'ru', 'en']);

export const localizedStringSchema = z.object({
  kk: z.string(),
  ru: z.string(),
  en: z.string(),
});

export const requestCodeSchema = z.object({
  username: z.string().min(1).max(100),
});

export const verifyCodeSchema = z.object({
  username: z.string().min(1).max(100),
  code: z.string().length(6),
});

export const startTestSchema = z.object({
  templateId: z.string().uuid(),
  language: languageSchema,
});

export const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedIds: z.array(z.string().uuid()).min(1),
});

export const updateProfileSchema = z.object({
  preferredLanguage: languageSchema.optional(),
});

// Admin schemas
export const createQuestionSchema = z.object({
  topicId: z.string().uuid(),
  subjectId: z.string().uuid(),
  examTypeId: z.string().uuid(),
  difficulty: z.number().int().min(1).max(5),
  type: z.enum(['single_choice', 'multiple_choice', 'matching', 'ordering']),
  content: z.record(languageSchema, z.object({
    text: z.string().min(1),
    hint: z.string().optional(),
  })),
  explanation: z.record(languageSchema, z.string()).optional(),
  imageUrls: z.array(z.string().url()).optional(),
  answerOptions: z.array(z.object({
    content: localizedStringSchema,
    isCorrect: z.boolean(),
    sortOrder: z.number().int(),
  })).min(2),
});

export const grantSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  planType: z.enum(['monthly', 'yearly', 'exam_specific']),
  examTypeId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  paymentNote: z.string().optional(),
});
