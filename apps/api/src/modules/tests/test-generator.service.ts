import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { questionWhereForTestLanguage } from '../../common/question-locale';
import { ENT_CONFIG } from '@bilimland/shared';

export interface GeneratedSection {
  subjectId: string;
  questionIds: string[];
  sortOrder: number;
  /** ЕНТ профиль: с какого 1-based индекса в секции — 2 балла; null — в скорере по умолчанию 31 */
  profileHeavyFrom?: number | null;
}

/** Режим прохождения ЕНТ (только для exam slug `ent`). */
export type EntPassScope = 'mandatory' | 'profile' | 'full';

@Injectable()
export class TestGeneratorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate questions from a template.
   * If profileSubjectIds are provided, they are added as extra sections
   * (for exams like ENT where user picks 2 profile subjects).
   * Для ЕНТ: entScope — только обязательные блоки, только профиль или полный вариант.
   */
  async generateFromTemplate(
    templateId: string,
    profileSubjectIds?: string[],
    profileQuestionCount = 20,
    /** если задан — случайный выбор сначала из вопросов, которые юзер ещё не видел в тестах */
    userId?: string,
    /** язык сессии: фильтр по metadata.contentLocale (kk | ru) */
    language?: string,
    opts?: { entScope?: EntPassScope },
  ): Promise<GeneratedSection[]> {
    const template = await this.prisma.testTemplate.findUnique({
      where: { id: templateId },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
          include: {
            subject: { select: { slug: true, isMandatory: true } },
          },
        },
        examType: { select: { slug: true } },
      },
    });

    if (!template) throw new Error('Template not found');

    const examSlug = template.examType?.slug ?? '';
    const entScope = examSlug === 'ent' ? opts?.entScope : undefined;
    const strictEntFull = examSlug === 'ent' && entScope === 'full';

    const sections: GeneratedSection[] = [];

    if (strictEntFull && profileQuestionCount !== ENT_CONFIG.profileQuestionsPerSubject) {
      throw new BadRequestException(
        `ENT full requires ${ENT_CONFIG.profileQuestionsPerSubject} questions per profile subject`,
      );
    }

    const includeTemplateSections = !entScope || entScope !== 'profile';
    if (includeTemplateSections) {
      for (const section of template.sections) {
        const questionIds =
          strictEntFull && section.subject?.slug === 'history_kz'
            ? await this.selectStrictEntHistoryQuestions(
                section.subjectId,
                userId,
                language,
              )
            : await this.selectQuestions(
                section.subjectId,
                section.questionCount,
                section.selectionMode,
                userId,
                language,
                strictEntFull,
              );
        if (strictEntFull && questionIds.length !== section.questionCount) {
          throw new BadRequestException(
            `ENT full question bank is insufficient for subject ${section.subjectId}: expected ${section.questionCount}, got ${questionIds.length}`,
          );
        }
        sections.push({
          subjectId: section.subjectId,
          questionIds,
          sortOrder: section.sortOrder,
          profileHeavyFrom: section.profileHeavyFrom ?? null,
        });
      }
    }

    const includeProfiles =
      profileSubjectIds &&
      profileSubjectIds.length > 0 &&
      (!entScope || entScope === 'full' || entScope === 'profile');

    if (includeProfiles) {
      const lastSortOrder =
        sections.length > 0 ? Math.max(...sections.map((s) => s.sortOrder)) : 0;

      for (let i = 0; i < profileSubjectIds!.length; i++) {
        const subjectId = profileSubjectIds![i];
        if (sections.some((s) => s.subjectId === subjectId)) continue;

        const questionIds = strictEntFull
          ? await this.selectStrictEntProfileQuestions(subjectId, userId, language)
          : await this.selectQuestions(
              subjectId,
              profileQuestionCount,
              'random',
              userId,
              language,
              false,
            );
        if (strictEntFull && questionIds.length !== profileQuestionCount) {
          throw new BadRequestException(
            `ENT full question bank is insufficient for profile subject ${subjectId}: expected ${profileQuestionCount}, got ${questionIds.length}`,
          );
        }
        sections.push({
          subjectId,
          questionIds,
          sortOrder: lastSortOrder + i + 1,
          profileHeavyFrom: ENT_CONFIG.profileTier1Count + 1,
        });
      }
    }

    return sections;
  }

  private async selectQuestions(
    subjectId: string,
    count: number,
    selectionMode: string,
    userId?: string,
    language?: string,
    allowLanguageFallback = false,
  ): Promise<string[]> {
    const localeWhere = questionWhereForTestLanguage(language);
    const makeWhere = (withLocale: boolean) => ({
      AND: withLocale
        ? [{ subjectId }, { isActive: true }, localeWhere]
        : [{ subjectId }, { isActive: true }],
    });
    const selectFromWhere = async (where: ReturnType<typeof makeWhere>) => {
      if (selectionMode === 'random') {
        const questions = await this.prisma.question.findMany({
          where,
          select: { id: true },
        });
        if (questions.length === 0) return [];

        const ids = questions.map((q) => q.id);
        const ordered = await this.orderWithFreshFirst(ids, userId);
        return ordered.slice(0, count);
      }

      const questions = await this.prisma.question.findMany({
        where,
        select: { id: true },
        take: count,
        orderBy: { createdAt: 'asc' },
      });
      return questions.map((q) => q.id);
    };

    const selected = await selectFromWhere(makeWhere(true));
    if (selected.length >= count || !allowLanguageFallback || !language) {
      return selected;
    }

    const fallbackSelected = await selectFromWhere(makeWhere(false));
    if (fallbackSelected.length <= selected.length) {
      return selected;
    }
    return fallbackSelected;
  }

  /**
   * Strict ENT full profile generation:
   * - first 30 questions stay in 1-point tier
   * - questions 31-35 are 8-option 2-point tasks with max 2 correct answers
   * - questions 36-40 are 6-option 2-point tasks with max 3 correct answers
   * - shuffle is allowed only inside each exact tier block
   */
  private async selectStrictEntProfileQuestions(
    subjectId: string,
    userId?: string,
    language?: string,
  ): Promise<string[]> {
    const selectedWithLocale = await this.selectStrictEntProfileQuestionsFromPool(
      subjectId,
      userId,
      language,
    );
    if (
      selectedWithLocale.length >= ENT_CONFIG.profileQuestionsPerSubject ||
      !language
    ) {
      return selectedWithLocale;
    }

    const selectedWithFallback = await this.selectStrictEntProfileQuestionsFromPool(
      subjectId,
      userId,
    );
    if (selectedWithFallback.length <= selectedWithLocale.length) {
      return selectedWithLocale;
    }
    return selectedWithFallback;
  }

  private async selectStrictEntProfileQuestionsFromPool(
    subjectId: string,
    userId?: string,
    language?: string,
  ): Promise<string[]> {
    const localeWhere = questionWhereForTestLanguage(language);
    const questions = await this.prisma.question.findMany({
      where: {
        AND: language
          ? [{ subjectId }, { isActive: true }, localeWhere]
          : [{ subjectId }, { isActive: true }],
      },
      select: {
        id: true,
        answerOptions: { select: { isCorrect: true } },
      },
    });
    if (questions.length === 0) return [];

    const regularIds = questions
      .filter((q) => this.isStrictEntProfileTier1Question(q))
      .map((q) => q.id);
    const tier2AIds = questions
      .filter((q) => this.isStrictEntProfileTier2AQuestion(q))
      .map((q) => q.id);
    const tier2BIds = questions
      .filter((q) => this.isStrictEntProfileTier2BQuestion(q))
      .map((q) => q.id);

    const orderedRegular = await this.orderWithFreshFirst(regularIds, userId);
    const orderedTier2A = await this.orderWithFreshFirst(tier2AIds, userId);
    const orderedTier2B = await this.orderWithFreshFirst(tier2BIds, userId);

    const selectedTier1 = this.takeUnique(
      [orderedRegular],
      ENT_CONFIG.profileTier1Count,
    );
    const selectedTier2A = this.takeUnique(
      [orderedTier2A],
      ENT_CONFIG.profileTier2ACount,
    );
    const selectedTier2B = this.takeUnique(
      [orderedTier2B],
      ENT_CONFIG.profileTier2BCount,
    );

    return [
      ...this.shuffle(selectedTier1),
      ...this.shuffle(selectedTier2A),
      ...this.shuffle(selectedTier2B),
    ];
  }

  private async selectStrictEntHistoryQuestions(
    subjectId: string,
    userId?: string,
    language?: string,
  ): Promise<string[]> {
    const selectedWithLocale = await this.selectStrictEntHistoryQuestionsFromPool(
      subjectId,
      userId,
      language,
    );
    const expected = ENT_CONFIG.mandatoryQuestionCounts.history_kz;
    if (selectedWithLocale.length >= expected || !language) {
      return selectedWithLocale;
    }

    const selectedWithFallback = await this.selectStrictEntHistoryQuestionsFromPool(
      subjectId,
      userId,
    );
    if (selectedWithFallback.length <= selectedWithLocale.length) {
      return selectedWithLocale;
    }
    return selectedWithFallback;
  }

  private async selectStrictEntHistoryQuestionsFromPool(
    subjectId: string,
    userId?: string,
    language?: string,
  ): Promise<string[]> {
    const localeWhere = questionWhereForTestLanguage(language);
    const questions = await this.prisma.question.findMany({
      where: {
        AND: language
          ? [{ subjectId }, { isActive: true }, localeWhere]
          : [{ subjectId }, { isActive: true }],
      },
      select: {
        id: true,
        content: true,
      },
    });
    if (questions.length === 0) return [];

    const noTextIds = questions
      .filter((q) => !this.isHistoryTextQuestion(q.content))
      .map((q) => q.id);
    const textIds = questions
      .filter((q) => this.isHistoryTextQuestion(q.content))
      .map((q) => q.id);

    const orderedNoText = await this.orderWithFreshFirst(noTextIds, userId);
    const orderedText = await this.orderWithFreshFirst(textIds, userId);

    return [
      ...this.shuffle(this.takeUnique([orderedNoText], 10)),
      ...this.shuffle(this.takeUnique([orderedText], 10)),
    ];
  }

  private isStrictEntProfileTier1Question(question: {
    answerOptions?: Array<{ isCorrect: boolean }>;
  }): boolean {
    return (
      this.countAnswerOptions(question) === ENT_CONFIG.profileTier1OptionCount &&
      this.countCorrectOptions(question) === ENT_CONFIG.profileTier1CorrectCount
    );
  }

  private isStrictEntProfileTier2AQuestion(question: {
    answerOptions?: Array<{ isCorrect: boolean }>;
  }): boolean {
    const correctCount = this.countCorrectOptions(question);
    return (
      this.countAnswerOptions(question) === ENT_CONFIG.profileTier2AOptionCount &&
      correctCount >= 1 &&
      correctCount <= ENT_CONFIG.profileTier2ACorrectCount
    );
  }

  private isStrictEntProfileTier2BQuestion(question: {
    answerOptions?: Array<{ isCorrect: boolean }>;
  }): boolean {
    const correctCount = this.countCorrectOptions(question);
    return (
      this.countAnswerOptions(question) === ENT_CONFIG.profileTier2BOptionCount &&
      correctCount >= 1 &&
      correctCount <= ENT_CONFIG.profileTier2BCorrectCount
    );
  }

  private countAnswerOptions(question: {
    answerOptions?: Array<{ isCorrect: boolean }>;
  }): number {
    return Array.isArray(question.answerOptions) ? question.answerOptions.length : 0;
  }

  private countCorrectOptions(question: {
    answerOptions?: Array<{ isCorrect: boolean }>;
  }): number {
    return Array.isArray(question.answerOptions)
      ? question.answerOptions.filter((o) => o.isCorrect).length
      : 0;
  }

  private isHistoryTextQuestion(content: unknown): boolean {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      return false;
    }
    const root = content as Record<string, unknown>;
    if (this.hasNonEmptyString(root.passage)) return true;
    const candidateText = this.collectLocalizedContentText(root).join('\n');
    const normalized = candidateText.toLocaleUpperCase('ru');
    return normalized.includes('ТЕКСТ') || normalized.includes('МӘТІН');
  }

  private collectLocalizedContentText(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const out: string[] = [];
    for (const child of Object.values(value as Record<string, unknown>)) {
      out.push(...this.collectLocalizedContentText(child));
    }
    return out;
  }

  private hasNonEmptyString(value: unknown): boolean {
    if (typeof value === 'string') return value.trim().length > 0;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.values(value as Record<string, unknown>).some(
      (child) => typeof child === 'string' && child.trim().length > 0,
    );
  }

  private async orderWithFreshFirst(
    ids: string[],
    userId?: string,
  ): Promise<string[]> {
    if (ids.length === 0) return [];
    if (!userId) return this.shuffle([...ids]);

    const seenRows = await this.prisma.testAnswer.findMany({
      where: {
        session: { userId },
        questionId: { in: ids },
      },
      distinct: ['questionId'],
      select: { questionId: true },
    });
    const seen = new Set(seenRows.map((r) => r.questionId));
    const fresh = ids.filter((id) => !seen.has(id));
    const repeat = ids.filter((id) => seen.has(id));
    return [...this.shuffle(fresh), ...this.shuffle(repeat)];
  }

  private takeUnique(pools: string[][], count: number): string[] {
    if (count <= 0) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const pool of pools) {
      for (const id of pool) {
        if (seen.has(id)) continue;
        out.push(id);
        seen.add(id);
        if (out.length >= count) return out;
      }
    }
    return out;
  }

  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
