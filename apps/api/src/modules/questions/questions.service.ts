import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  QUESTION_METADATA_LOCALE_KEY,
  type QuestionContentLocale,
} from '../../common/question-locale';
import {
  combineTopicAndStem,
  extractSlot,
  previewFromSlot,
  questionTextSimilarity,
} from '../../common/question-similarity';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    topicId: string;
    subjectId: string;
    examTypeId: string;
    difficulty: number;
    type: string;
    content: Prisma.InputJsonValue;
    explanation?: Prisma.InputJsonValue;
    imageUrls?: string[];
    /** kk | ru — для выборки вопросов по языку теста */
    contentLocale?: QuestionContentLocale;
    answerOptions: { content: Prisma.InputJsonValue; isCorrect: boolean; sortOrder: number }[];
    /** ЕНТ: явный вес в баллах (1–5); null — по правилу секции шаблона */
    scoreWeight?: number | null;
  }) {
    const loc = data.contentLocale ?? 'ru';
    const sw =
      data.scoreWeight === undefined || data.scoreWeight === null
        ? null
        : Math.round(Number(data.scoreWeight));
    return this.prisma.question.create({
      data: {
        topicId: data.topicId,
        subjectId: data.subjectId,
        examTypeId: data.examTypeId,
        difficulty: data.difficulty,
        type: data.type,
        scoreWeight: sw !== null && Number.isFinite(sw) ? Math.max(1, Math.min(5, sw)) : null,
        content: data.content,
        explanation: data.explanation ?? Prisma.DbNull,
        imageUrls: data.imageUrls ?? Prisma.DbNull,
        metadata: {
          [QUESTION_METADATA_LOCALE_KEY]: loc,
        } as Prisma.InputJsonValue,
        answerOptions: {
          create: data.answerOptions.map((opt) => ({
            content: opt.content,
            isCorrect: opt.isCorrect,
            sortOrder: opt.sortOrder,
          })),
        },
      },
      include: { answerOptions: true },
    });
  }

  async findMany(filters: {
    id?: string;
    examTypeId?: string;
    subjectId?: string;
    topicId?: string;
    difficulty?: number;
    hasExplanation?: boolean;
    /** kk | ru — только с меткой; unset — без metadata (legacy) */
    contentLocale?: 'kk' | 'ru' | 'unset';
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, contentLocale, ...where } = filters;
    const whereClause: Prisma.QuestionWhereInput = { isActive: true };

    if (where.id) whereClause.id = where.id;
    if (where.examTypeId) whereClause.examTypeId = where.examTypeId;
    if (where.subjectId) whereClause.subjectId = where.subjectId;
    if (where.topicId) whereClause.topicId = where.topicId;
    if (where.difficulty) whereClause.difficulty = where.difficulty;
    if (where.hasExplanation === true) {
      whereClause.explanation = { not: Prisma.DbNull };
    }

    if (contentLocale === 'kk') {
      whereClause.metadata = {
        path: [QUESTION_METADATA_LOCALE_KEY],
        equals: 'kk',
      };
    } else if (contentLocale === 'ru') {
      whereClause.metadata = {
        path: [QUESTION_METADATA_LOCALE_KEY],
        equals: 'ru',
      };
    } else if (contentLocale === 'unset') {
      whereClause.metadata = { equals: Prisma.DbNull };
    }

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where: whereClause,
        include: {
          answerOptions: { orderBy: { sortOrder: 'asc' } },
          subject: { select: { id: true, name: true, slug: true } },
          examType: { select: { id: true, name: true, slug: true } },
          topic: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.question.count({ where: whereClause }),
    ]);

    return { items, total, page, limit };
  }

  async update(id: string, data: Prisma.QuestionUpdateInput) {
    return this.prisma.question.update({
      where: { id },
      data,
      include: { answerOptions: true },
    });
  }

  /**
   * Полное обновление вопроса из админки: контент, метаданные, варианты (полная замена списка).
   */
  async updateFull(
    id: string,
    data: {
      topicId?: string;
      subjectId?: string;
      examTypeId?: string;
      difficulty?: number;
      type?: string;
      content?: Prisma.InputJsonValue;
      explanation?: Prisma.InputJsonValue | null;
      imageUrls?: string[] | null;
      contentLocale?: QuestionContentLocale;
      answerOptions?: { content: Prisma.InputJsonValue; isCorrect: boolean; sortOrder: number }[];
      scoreWeight?: number | null;
    },
  ) {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Question not found');

    const prevMeta =
      existing.metadata && typeof existing.metadata === 'object' && existing.metadata !== null
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};

    if (data.contentLocale !== undefined) {
      prevMeta[QUESTION_METADATA_LOCALE_KEY] = data.contentLocale;
    }

    const replaceAnswers = Array.isArray(data.answerOptions) && data.answerOptions.length > 0;

    return this.prisma.$transaction(async (tx) => {
      if (replaceAnswers) {
        await tx.answerOption.deleteMany({ where: { questionId: id } });
      }

      return tx.question.update({
        where: { id },
        data: {
          ...(data.topicId !== undefined ? { topicId: data.topicId } : {}),
          ...(data.subjectId !== undefined ? { subjectId: data.subjectId } : {}),
          ...(data.examTypeId !== undefined ? { examTypeId: data.examTypeId } : {}),
          ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.scoreWeight !== undefined
            ? {
                scoreWeight:
                  data.scoreWeight === null
                    ? null
                    : (() => {
                        const sw = Math.round(Number(data.scoreWeight));
                        return Number.isFinite(sw) ? Math.max(1, Math.min(5, sw)) : null;
                      })(),
              }
            : {}),
          ...(data.content !== undefined ? { content: data.content } : {}),
          ...(data.explanation !== undefined
            ? { explanation: data.explanation === null ? Prisma.DbNull : data.explanation }
            : {}),
          ...(data.imageUrls !== undefined
            ? {
                imageUrls:
                  data.imageUrls === null ? Prisma.DbNull : (data.imageUrls as unknown as Prisma.InputJsonValue),
              }
            : {}),
          ...(data.contentLocale !== undefined ? { metadata: prevMeta as Prisma.InputJsonValue } : {}),
          ...(replaceAnswers
            ? {
                answerOptions: {
                  create: data.answerOptions!.map((opt) => ({
                    content: opt.content,
                    isCorrect: opt.isCorrect,
                    sortOrder: opt.sortOrder,
                  })),
                },
              }
            : {}),
        },
        include: {
          answerOptions: { orderBy: { sortOrder: 'asc' } },
          subject: { select: { id: true, name: true, slug: true } },
          examType: { select: { id: true, name: true, slug: true } },
          topic: { select: { id: true, name: true } },
        },
      });
    });
  }

  /**
   * Похожие вопросы по тексту условия (тот же экзамен + предмет). Без pg_trgm: до 900 строк, скоринг в памяти.
   */
  async findSimilar(params: {
    examTypeId: string;
    /** Если не задан — поиск по всем предметам этого типа экзамена (до take строк). */
    subjectId?: string;
    locale: 'ru' | 'kk';
    text: string;
    excludeId?: string;
    threshold?: number;
    limit?: number;
  }) {
    const threshold = params.threshold ?? 0.45;
    const limit = Math.min(Math.max(1, params.limit ?? 12), 60);
    const needle = params.text.trim();

    if (!needle || needle.length < 4) {
      return { items: [] as { id: string; score: number; preview: string }[] };
    }

    const rows = await this.prisma.question.findMany({
      where: {
        examTypeId: params.examTypeId,
        ...(params.subjectId ? { subjectId: params.subjectId } : {}),
        isActive: true,
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      },
      select: { id: true, content: true },
      orderBy: { updatedAt: 'desc' },
      take: 900,
    });

    const scored = rows
      .map((row) => {
        const slotRu = extractSlot(row.content, 'ru');
        const slotKk = extractSlot(row.content, 'kk');
        const hayRu = combineTopicAndStem(slotRu);
        const hayKk = combineTopicAndStem(slotKk);
        const scoreRu = questionTextSimilarity(needle, hayRu);
        const scoreKk = questionTextSimilarity(needle, hayKk);
        let score = Math.max(scoreRu, scoreKk);
        let previewSlot = slotKk;
        if (scoreRu > scoreKk) previewSlot = slotRu;
        else if (scoreRu === scoreKk && scoreRu > 0) {
          previewSlot = params.locale === 'kk' ? slotKk : slotRu;
        }
        return {
          id: row.id,
          score,
          preview: previewFromSlot(previewSlot, 160),
        };
      })
      .filter((x) => x.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { items: scored };
  }

  async delete(id: string) {
    return this.prisma.question.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
