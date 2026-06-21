import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AiLessonNoteReason, AiLessonNoteStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MistakesService } from '../tests/mistakes.service';
import { AiCoachService, TopicLesson } from './ai-coach.service';
import { AiQuotaService } from './ai-quota.service';
import { DeepseekClient } from './infrastructure/deepseek.client';
import { extractQuestionText, localizeFlat, truncate } from './ai-content.util';
import {
  AiLanguage,
  PromptClassifyQuestion,
  PromptLessonQuestion,
  classifySystemPrompt,
  classifyUserPrompt,
  themeTaxonomySystemPrompt,
  themeTaxonomyUserPrompt,
} from './ai.prompts';

const TAXONOMY_LANG: AiLanguage = 'ru'; // canonical theme names; shared across users
const LESSON_VERSION = 'v3';
const TAXONOMY_SAMPLE = 30;
const CLASSIFY_BATCH = 40;
const MAX_CLASSIFY_BATCHES_PER_CALL = 6; // bound cost per study-map load
const LESSON_SAMPLE = 12;
const QUESTION_CHAR_CAP = 320;
const OPTION_CHAR_CAP = 160;
const EXPLANATION_CHAR_CAP = 500;

interface ThemeRow {
  id: string;
  key: string;
  name: unknown;
  sortOrder: number;
}

export interface StudyMapTheme {
  themeId: string;
  key: string;
  name: string;
  openCount: number;
  activeOpenCount: number;
}

export interface StudyMap {
  examTypeId: string;
  examName: unknown;
  subjectId: string;
  subjectName: unknown;
  themes: StudyMapTheme[];
  otherOpenCount: number;
  otherActiveOpenCount: number;
  openTotal: number;
  activeOpenTotal: number;
  classifiedCount: number;
  unclassifiedCount: number;
  pending: boolean; // true while classification is still incomplete (quota/scale)
}

type LessonNoteWithRelations = Prisma.AiLessonNoteGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        telegramUsername: true;
        email: true;
        phone: true;
      };
    };
    reviewer: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        telegramUsername: true;
        email: true;
      };
    };
    themeLesson: {
      include: {
        theme: { select: { id: true; key: true; name: true } };
        subject: { select: { id: true; slug: true; name: true } };
      };
    };
    topicLesson: {
      include: {
        topic: { select: { id: true; name: true } };
        subject: { select: { id: true; slug: true; name: true } };
      };
    };
  };
}>;

@Injectable()
export class StudyThemeService {
  private readonly logger = new Logger(StudyThemeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mistakes: MistakesService,
    private readonly aiCoach: AiCoachService,
    private readonly quota: AiQuotaService,
    private readonly deepseek: DeepseekClient,
  ) {}

  isEnabled(): boolean {
    return this.deepseek.isEnabled();
  }

  // ─── taxonomy ────────────────────────────────────────────────────────────────

  /** Returns the subject's study themes, AI-seeding them once if absent. */
  async ensureTaxonomy(userId: string, subjectId: string): Promise<ThemeRow[]> {
    const existing = await this.prisma.subjectStudyTheme.findMany({
      where: { subjectId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, key: true, name: true, sortOrder: true },
    });
    if (existing.length > 0) return existing;
    if (!this.isEnabled()) return [];

    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: { examType: { select: { id: true, name: true, slug: true } } },
    });
    if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');

    const sample = await this.prisma.question.findMany({
      where: { subjectId, isActive: true },
      orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
      take: TAXONOMY_SAMPLE,
      select: { content: true },
    });
    const sampleQuestions = sample
      .map((q) => truncate(extractQuestionText(q.content, TAXONOMY_LANG), QUESTION_CHAR_CAP))
      .filter(Boolean);

    await this.quota.reserve(userId, 'taxonomy');
    const raw = await this.deepseek.chatJson<{ themes?: unknown }>({
      system: themeTaxonomySystemPrompt(TAXONOMY_LANG),
      user: themeTaxonomyUserPrompt({
        exam: localizeFlat(subject.examType.name, TAXONOMY_LANG, subject.examType.slug),
        subject: localizeFlat(subject.name, TAXONOMY_LANG, subject.slug),
        sampleQuestions,
      }),
      temperature: 0.3,
      maxTokens: 1500,
    });

    const seen = new Set<string>();
    const themes = (Array.isArray(raw.themes) ? raw.themes : [])
      .map((t) => {
        const rec = t as Record<string, unknown>;
        const key = slugify(typeof rec.key === 'string' ? rec.key : '');
        const name = typeof rec.name === 'string' ? rec.name.trim() : '';
        return { key, name };
      })
      .filter((t) => t.key && t.name && !seen.has(t.key) && (seen.add(t.key), true))
      .slice(0, 16);

    if (themes.length === 0) return [];

    await this.prisma.subjectStudyTheme.createMany({
      data: themes.map((t, i) => ({
        examTypeId: subject.examTypeId,
        subjectId,
        key: t.key,
        name: { [TAXONOMY_LANG]: t.name } as object,
        sortOrder: i,
      })),
      skipDuplicates: true,
    });

    return this.prisma.subjectStudyTheme.findMany({
      where: { subjectId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, key: true, name: true, sortOrder: true },
    });
  }

  // ─── classification ──────────────────────────────────────────────────────────

  /**
   * Classify the user's currently-open mistakes in a subject into themes, caching
   * results globally (one row per question, reused across users). Bounded per call;
   * returns false when work remains (so the caller can mark the map "pending").
   */
  private async classifyOpenMistakes(
    userId: string,
    subjectId: string,
    themes: ThemeRow[],
    openQuestionIds: string[],
  ): Promise<'complete' | 'more' | 'stopped'> {
    if (themes.length === 0 || openQuestionIds.length === 0) return 'complete';

    const already = await this.prisma.questionThemeClassification.findMany({
      where: { questionId: { in: openQuestionIds } },
      select: { questionId: true },
    });
    const done = new Set(already.map((r) => r.questionId));
    const todo = openQuestionIds.filter((id) => !done.has(id));
    if (todo.length === 0) return 'complete';

    const keyToThemeId = new Map(themes.map((t) => [t.key, t.id]));
    const themeList = themes.map((t) => ({
      key: t.key,
      name: localizeFlat(t.name, TAXONOMY_LANG, t.key),
    }));
    const subjectName = await this.prisma.subject
      .findUnique({ where: { id: subjectId }, select: { name: true, slug: true } })
      .then((s) => (s ? localizeFlat(s.name, TAXONOMY_LANG, s.slug) : 'Предмет'));

    let processed = 0;
    for (let i = 0; i < todo.length; i += CLASSIFY_BATCH) {
      if (processed >= MAX_CLASSIFY_BATCHES_PER_CALL) {
        return 'more'; // genuine progress; the rest classifies on a later load
      }
      const batchIds = todo.slice(i, i + CLASSIFY_BATCH);
      const questions = await this.prisma.question.findMany({
        where: { id: { in: batchIds } },
        select: { id: true, content: true },
      });
      const refToId = new Map<number, string>();
      const promptQuestions: PromptClassifyQuestion[] = questions.map((q, idx) => {
        refToId.set(idx, q.id);
        return { ref: idx, question: truncate(extractQuestionText(q.content, TAXONOMY_LANG), QUESTION_CHAR_CAP) };
      });

      try {
        await this.quota.reserve(userId, 'classify');
        const raw = await this.deepseek.chatJson<{ assignments?: unknown }>({
          system: classifySystemPrompt(),
          user: classifyUserPrompt({ subject: subjectName, themes: themeList, questions: promptQuestions }),
          temperature: 0.1,
          maxTokens: 1200,
        });
        const assignments = Array.isArray(raw.assignments) ? raw.assignments : [];
        const rows = assignments
          .map((a) => {
            const rec = a as Record<string, unknown>;
            const ref = Number(rec.ref);
            const key = typeof rec.key === 'string' ? slugify(rec.key) : '';
            const questionId = refToId.get(ref);
            if (!questionId) return null;
            return { questionId, themeId: keyToThemeId.get(key) ?? null };
          })
          .filter((r): r is { questionId: string; themeId: string | null } => r != null);

        // Any question the model skipped → mark as classified-to-null so we don't retry it forever.
        const answered = new Set(rows.map((r) => r.questionId));
        for (const id of batchIds) {
          if (!answered.has(id)) rows.push({ questionId: id, themeId: null });
        }

        await this.prisma.questionThemeClassification.createMany({
          data: rows.map((r) => ({
            questionId: r.questionId,
            subjectId,
            themeId: r.themeId,
            model: this.deepseek.getModel(),
          })),
          skipDuplicates: true,
        });
      } catch (err) {
        // Quota/upstream error → stop. NOT "more" — so the client stops polling
        // (the unclassified rest shows under "Прочие" and classifies on a later visit).
        this.logger.warn(`Classification stopped: ${err instanceof Error ? err.message : err}`);
        return 'stopped';
      }
      processed++;
    }
    return 'complete';
  }

  // ─── study map ───────────────────────────────────────────────────────────────

  async getStudyMap(userId: string, subjectId: string, examTypeId?: string): Promise<StudyMap> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, ...(examTypeId ? { examTypeId } : {}) },
      include: { examType: { select: { id: true, name: true, slug: true } } },
    });
    if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');

    const latest = await this.mistakes.getLatestOutcomes(userId);
    const open = latest.filter(
      (r) => r.isCorrect === false && r.subjectId === subjectId && (!examTypeId || r.examTypeId === examTypeId),
    );
    const openIds = open.map((r) => r.questionId);

    const themes = this.isEnabled() ? await this.ensureTaxonomy(userId, subjectId) : [];
    let pending = false;
    if (themes.length > 0 && openIds.length > 0) {
      const status = await this.classifyOpenMistakes(userId, subjectId, themes, openIds);
      // Only "more" means auto-classification will continue → worth polling.
      // "stopped" (quota/error) must NOT keep the client polling forever.
      pending = status === 'more';
    }

    const [classifications, activeRows] = await Promise.all([
      this.prisma.questionThemeClassification.findMany({
        where: { questionId: { in: openIds } },
        select: { questionId: true, themeId: true },
      }),
      this.prisma.question.findMany({
        where: { id: { in: openIds } },
        select: { id: true, isActive: true },
      }),
    ]);
    const themeByQuestion = new Map(classifications.map((c) => [c.questionId, c.themeId]));
    const activeById = new Map(activeRows.map((q) => [q.id, q.isActive]));

    const counts = new Map<string, { open: number; active: number }>();
    let otherOpen = 0;
    let otherActive = 0;
    let unclassified = 0;
    for (const id of openIds) {
      const active = activeById.get(id) ?? false;
      const themeId = themeByQuestion.get(id);
      if (!themeByQuestion.has(id)) unclassified++;
      if (themeId) {
        const c = counts.get(themeId) ?? { open: 0, active: 0 };
        c.open++;
        if (active) c.active++;
        counts.set(themeId, c);
      } else {
        otherOpen++;
        if (active) otherActive++;
      }
    }

    const themeRows: StudyMapTheme[] = themes
      .map((t) => {
        const c = counts.get(t.id) ?? { open: 0, active: 0 };
        return {
          themeId: t.id,
          key: t.key,
          name: localizeFlat(t.name, 'ru', t.key),
          openCount: c.open,
          activeOpenCount: c.active,
        };
      })
      .filter((t) => t.openCount > 0)
      .sort((a, b) => b.openCount - a.openCount);

    return {
      examTypeId: subject.examTypeId,
      examName: subject.examType.name,
      subjectId: subject.id,
      subjectName: subject.name,
      themes: themeRows,
      otherOpenCount: otherOpen,
      otherActiveOpenCount: otherActive,
      openTotal: openIds.length,
      activeOpenTotal: [...activeById.values()].filter(Boolean).length,
      classifiedCount: openIds.length - unclassified,
      unclassifiedCount: unclassified,
      pending,
    };
  }

  // ─── theme lesson ──────────────────────────────────────────────────────────────

  async getThemeLesson(
    userId: string,
    themeId: string,
    language: string,
    force = false,
  ): Promise<TopicLesson> {
    if (!this.isEnabled()) throw new BadRequestException('AI_DISABLED');
    const lang: AiLanguage = language === 'kk' ? 'kk' : 'ru';

    const theme = await this.prisma.subjectStudyTheme.findUnique({
      where: { id: themeId },
      include: {
        subject: { select: { id: true, name: true, slug: true } },
        examType: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!theme) throw new NotFoundException('THEME_NOT_FOUND');

    // Gate: the user must have an open mistake in this theme.
    const latest = await this.mistakes.getLatestOutcomes(userId);
    const openIds = latest
      .filter((r) => r.isCorrect === false && r.subjectId === theme.subjectId)
      .map((r) => r.questionId);
    const openInTheme = openIds.length
      ? await this.prisma.questionThemeClassification.count({
          where: { themeId, questionId: { in: openIds } },
        })
      : 0;
    if (openInTheme === 0) throw new BadRequestException('NO_OPEN_MISTAKES_FOR_THEME');

    if (!force) {
      const cached = await this.prisma.subjectThemeLesson.findUnique({
        where: { themeId_language_lessonVersion: { themeId, language: lang, lessonVersion: LESSON_VERSION } },
      });
      if (cached) {
        return {
          ...(cached.result as unknown as TopicLesson),
          lessonId: cached.id,
          lessonKind: 'theme',
          cached: true,
        };
      }
    }

    // Source questions: any active question in this theme (not just the user's).
    const sourceQuestions = await this.prisma.question.findMany({
      where: { isActive: true, themeClassification: { themeId } },
      include: { answerOptions: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
      take: LESSON_SAMPLE,
    });

    const themeName = localizeFlat(theme.name, lang, theme.key);
    const promptQuestions: PromptLessonQuestion[] = sourceQuestions.map((q, i) => ({
      ref: i,
      difficulty: q.difficulty,
      question: truncate(extractQuestionText(q.content, lang), QUESTION_CHAR_CAP),
      correctAnswer: q.answerOptions
        .filter((o) => o.isCorrect)
        .map((o) => truncate(localizeFlat(o.content, lang), OPTION_CHAR_CAP))
        .filter(Boolean)
        .join(' | '),
      explanation: truncate(localizeFlat(q.explanation, lang), EXPLANATION_CHAR_CAP),
    }));

    const lesson = await this.aiCoach.generateLesson(userId, {
      examTypeId: theme.examTypeId,
      subjectId: theme.subjectId,
      themeId: theme.id,
      examName: localizeFlat(theme.examType.name, lang, theme.examType.slug),
      subjectName: localizeFlat(theme.subject.name, lang, theme.subject.slug),
      themeName,
      questions: promptQuestions,
      language: lang,
    });

    const sourceHash = createHash('sha256')
      .update(
        [LESSON_VERSION, this.deepseek.getModel(), lang, themeId, sourceQuestions.map((q) => q.id).join(',')].join('|'),
      )
      .digest('hex')
      .slice(0, 64);

    const savedLesson = await this.prisma.subjectThemeLesson
      .upsert({
        where: { themeId_language_lessonVersion: { themeId, language: lang, lessonVersion: LESSON_VERSION } },
        create: {
          themeId,
          subjectId: theme.subjectId,
          language: lang,
          lessonVersion: LESSON_VERSION,
          model: this.deepseek.getModel(),
          title: truncate(lesson.title, 180),
          sourceHash,
          result: lesson as unknown as object,
        },
        update: {
          model: this.deepseek.getModel(),
          title: truncate(lesson.title, 180),
          sourceHash,
          result: lesson as unknown as object,
        },
      })
      .catch((err) => {
        this.logger.warn(`Failed to persist theme lesson: ${err?.message ?? err}`);
        return null;
      });

    return savedLesson
      ? { ...lesson, lessonId: savedLesson.id, lessonKind: 'theme' }
      : lesson;
  }

  async submitThemeLessonNote(
    userId: string,
    lessonId: string,
    data: { reason?: AiLessonNoteReason; message: string },
  ) {
    const message = trimToNull(data.message);
    if (!message || message.length < 12) {
      throw new BadRequestException('LESSON_NOTE_TOO_SHORT');
    }

    const lesson = await this.prisma.subjectThemeLesson.findUnique({
      where: { id: lessonId },
      include: {
        theme: { select: { id: true } },
      },
    });
    if (!lesson) throw new NotFoundException('LESSON_NOT_FOUND');

    const openQuestionIds = await this.getOpenQuestionIdsForTheme(userId, lesson.themeId);
    if (openQuestionIds.length === 0) {
      throw new BadRequestException('NO_OPEN_MISTAKES_FOR_THEME');
    }

    const note = await this.prisma.aiLessonNote.create({
      data: {
        userId,
        themeLessonId: lesson.id,
        examTypeId: null,
        subjectId: lesson.subjectId,
        themeId: lesson.themeId,
        language: lesson.language,
        lessonVersion: lesson.lessonVersion,
        reason: data.reason ?? AiLessonNoteReason.other,
        message,
      },
      include: this.lessonNoteInclude(),
    });

    return this.formatLessonNote(note);
  }

  async listAdminLessonNotes(filters: {
    page?: number;
    limit?: number;
    status?: AiLessonNoteStatus;
    reason?: AiLessonNoteReason;
    subjectId?: string;
    search?: string;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const search = trimToNull(filters.search);
    const looksLikeUuid =
      !!search &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        search,
      );

    const where: Prisma.AiLessonNoteWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.reason) where.reason = filters.reason;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { adminNote: { contains: search, mode: 'insensitive' } },
        ...(looksLikeUuid
          ? [
              { userId: search },
              { themeLessonId: search },
              { topicLessonId: search },
              { themeId: search },
              { topicId: search },
            ]
          : []),
        {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { telegramUsername: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [items, total, pendingCount, reviewCount, resolvedCount, rejectedCount] =
      await Promise.all([
        this.prisma.aiLessonNote.findMany({
          where,
          include: this.lessonNoteInclude(),
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.aiLessonNote.count({ where }),
        this.prisma.aiLessonNote.count({
          where: { ...where, status: AiLessonNoteStatus.pending },
        }),
        this.prisma.aiLessonNote.count({
          where: { ...where, status: AiLessonNoteStatus.under_review },
        }),
        this.prisma.aiLessonNote.count({
          where: { ...where, status: AiLessonNoteStatus.resolved },
        }),
        this.prisma.aiLessonNote.count({
          where: { ...where, status: AiLessonNoteStatus.rejected },
        }),
      ]);

    return {
      items: items.map((note) => this.formatLessonNote(note)),
      total,
      page,
      limit,
      stats: {
        open: pendingCount + reviewCount,
        pending: pendingCount,
        underReview: reviewCount,
        resolved: resolvedCount,
        rejected: rejectedCount,
      },
    };
  }

  async updateAdminLessonNote(
    id: string,
    adminId: string,
    data: { status?: AiLessonNoteStatus; adminNote?: string },
  ) {
    const existing = await this.prisma.aiLessonNote.findUnique({
      where: { id },
      include: this.lessonNoteInclude(),
    });
    if (!existing) throw new NotFoundException('LESSON_NOTE_NOT_FOUND');

    const nextStatus = data.status ?? existing.status;
    const adminNote =
      data.adminNote === undefined ? existing.adminNote : trimToNull(data.adminNote);
    if (
      (nextStatus === AiLessonNoteStatus.resolved ||
        nextStatus === AiLessonNoteStatus.rejected) &&
      !adminNote
    ) {
      throw new BadRequestException('LESSON_NOTE_ADMIN_NOTE_REQUIRED');
    }

    const finalState =
      nextStatus === AiLessonNoteStatus.resolved ||
      nextStatus === AiLessonNoteStatus.rejected;
    const updated = await this.prisma.aiLessonNote.update({
      where: { id },
      data: {
        status: nextStatus,
        adminNote,
        reviewedBy: finalState ? adminId : null,
        reviewedAt: finalState ? new Date() : null,
      },
      include: this.lessonNoteInclude(),
    });

    return this.formatLessonNote(updated);
  }

  /** Open-mistake question ids for a theme (for theme-scoped practice). */
  async getOpenQuestionIdsForTheme(userId: string, themeId: string): Promise<string[]> {
    const theme = await this.prisma.subjectStudyTheme.findUnique({
      where: { id: themeId },
      select: { subjectId: true },
    });
    if (!theme) return [];
    const latest = await this.mistakes.getLatestOutcomes(userId);
    const openIds = latest
      .filter((r) => r.isCorrect === false && r.subjectId === theme.subjectId)
      .map((r) => r.questionId);
    if (openIds.length === 0) return [];
    const rows = await this.prisma.questionThemeClassification.findMany({
      where: { themeId, questionId: { in: openIds } },
      select: { questionId: true },
    });
    return rows.map((r) => r.questionId);
  }

  private formatLessonNote(note: LessonNoteWithRelations) {
    const themeLesson = note.themeLesson;
    const topicLesson = note.topicLesson;
    return {
      id: note.id,
      userId: note.userId,
      themeLessonId: note.themeLessonId,
      topicLessonId: note.topicLessonId,
      subjectId: note.subjectId,
      themeId: note.themeId,
      topicId: note.topicId,
      language: note.language,
      lessonVersion: note.lessonVersion,
      reason: note.reason,
      message: note.message,
      status: note.status,
      adminNote: note.adminNote,
      reviewedAt: note.reviewedAt,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      user: note.user,
      reviewer: note.reviewer,
      lesson: themeLesson
        ? {
            kind: 'theme',
            id: themeLesson.id,
            title: themeLesson.title,
            model: themeLesson.model,
            theme: themeLesson.theme,
            subject: themeLesson.subject,
          }
        : topicLesson
          ? {
              kind: 'topic',
              id: topicLesson.id,
              title: topicLesson.title,
              model: topicLesson.model,
              topic: topicLesson.topic,
              subject: topicLesson.subject,
            }
          : null,
    };
  }

  private lessonNoteInclude() {
    return {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          telegramUsername: true,
          email: true,
          phone: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          telegramUsername: true,
          email: true,
        },
      },
      themeLesson: {
        include: {
          theme: { select: { id: true, key: true, name: true } },
          subject: { select: { id: true, slug: true, name: true } },
        },
      },
      topicLesson: {
        include: {
          topic: { select: { id: true, name: true } },
          subject: { select: { id: true, slug: true, name: true } },
        },
      },
    };
  }
}

function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
