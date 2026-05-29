import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { questionWhereForTestLanguage } from '../../common/question-locale';
import { ENT_CONFIG, type EntScope } from '@bilimland/shared';

export interface GeneratedSection {
  subjectId: string;
  questionIds: string[];
  sortOrder: number;
  /** ЕНТ профиль: с какого 1-based индекса в секции — 2 балла; null — в скорере по умолчанию 31 */
  profileHeavyFrom?: number | null;
}

/** Режим прохождения ЕНТ (только для exam slug `ent`). */
export type EntPassScope = EntScope;

@Injectable()
export class TestGeneratorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate questions from a template.
   * If profileSubjectIds are provided, they are added as extra sections
   * (for exams like ENT where user picks 2 profile subjects).
   * Для ЕНТ: entScope — обязательные блоки, профиль, полный вариант или формат для творческих специальностей.
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
    /** Строгая выборка истории Казахстана для любого ENT с обязательными блоками. */
    const strictEntHistory = examSlug === 'ent' && entScope !== 'profile';
    /** Строгая выборка профильных предметов для ENT (full или profile). */
    const strictEntProfile = examSlug === 'ent' && (entScope === 'full' || entScope === 'profile');
    /** Все шаблонные секции ENT подчиняются строгой padding/validation. */
    const strictEntSections = examSlug === 'ent' && entScope !== 'profile';
    const seenQuestionIds = await this.loadSeenQuestionIds(userId);

    const sections: GeneratedSection[] = [];

    if (strictEntProfile && profileQuestionCount !== ENT_CONFIG.profileQuestionsPerSubject) {
      throw new BadRequestException(
        `ENT ${entScope} requires ${ENT_CONFIG.profileQuestionsPerSubject} questions per profile subject`,
      );
    }

    const includeTemplateSections = !entScope || entScope !== 'profile';
    if (includeTemplateSections) {
      const templateSections =
        examSlug === 'ent' && entScope === 'creative'
          ? template.sections.filter((section) =>
              ENT_CONFIG.creativeSubjects.includes(
                section.subject?.slug as (typeof ENT_CONFIG.creativeSubjects)[number],
              ),
            )
          : template.sections;

      for (const section of templateSections) {
        let questionIds =
          strictEntHistory && section.subject?.slug === 'history_kz'
            ? await this.selectStrictEntHistoryQuestions(
                section.subjectId,
                language,
                seenQuestionIds,
              )
            : await this.selectQuestions(
                section.subjectId,
                section.questionCount,
                section.selectionMode,
                language,
                strictEntHistory,
                seenQuestionIds,
              );
        if (strictEntSections && questionIds.length < section.questionCount) {
          questionIds = await this.padSubjectQuestionIds(
            section.subjectId,
            questionIds,
            section.questionCount,
            language,
            seenQuestionIds,
          );
        }
        if (strictEntSections && questionIds.length !== section.questionCount) {
          throw new BadRequestException(
            `ENT ${entScope} question bank is insufficient for subject ${section.subjectId}: expected ${section.questionCount}, got ${questionIds.length}`,
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

        let questionIds = strictEntProfile
          ? await this.selectStrictEntProfileQuestions(subjectId, language, seenQuestionIds)
          : await this.selectQuestions(
              subjectId,
              profileQuestionCount,
              'random',
              language,
              false,
              seenQuestionIds,
            );
        if (strictEntProfile && questionIds.length < profileQuestionCount) {
          questionIds = await this.padSubjectQuestionIds(
            subjectId,
            questionIds,
            profileQuestionCount,
            language,
            seenQuestionIds,
          );
        }
        if (strictEntProfile && questionIds.length !== profileQuestionCount) {
          throw new BadRequestException(
            `ENT ${entScope} question bank is insufficient for profile subject ${subjectId}: expected ${profileQuestionCount}, got ${questionIds.length}`,
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
    language?: string,
    allowLanguageFallback = false,
    seenQuestionIds?: Set<string>,
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
        const ordered = this.orderWithFreshFirst(ids, seenQuestionIds);
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

  /** Добирает вопросы того же предмета до targetCount (строгий отбор уже взял часть пула). */
  private async padSubjectQuestionIds(
    subjectId: string,
    selectedIds: string[],
    targetCount: number,
    language?: string,
    seenQuestionIds?: Set<string>,
  ): Promise<string[]> {
    if (selectedIds.length >= targetCount) return selectedIds;
    const used = new Set(selectedIds);
    const collectIds = async (withLocaleFilter: boolean) => {
      const localeWhere =
        withLocaleFilter && language ? questionWhereForTestLanguage(language) : null;
      const rows = await this.prisma.question.findMany({
        where: {
          AND: localeWhere
            ? [{ subjectId }, { isActive: true }, localeWhere]
            : [{ subjectId }, { isActive: true }],
        },
        select: { id: true },
      });
      return rows.map((r) => r.id).filter((id) => !used.has(id));
    };

    let pool = await collectIds(true);
    if (pool.length < targetCount - selectedIds.length && language) {
      const more = await collectIds(false);
      const seen = new Set(pool);
      for (const id of more) {
        if (!seen.has(id)) {
          pool.push(id);
          seen.add(id);
        }
      }
    }

    const ordered = this.orderWithFreshFirst(pool, seenQuestionIds);
    const need = targetCount - selectedIds.length;
    return [...selectedIds, ...ordered.slice(0, need)];
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
    language?: string,
    seenQuestionIds?: Set<string>,
  ): Promise<string[]> {
    const selectedWithLocale = await this.selectStrictEntProfileQuestionsFromPool(
      subjectId,
      language,
      seenQuestionIds,
    );
    if (
      selectedWithLocale.length >= ENT_CONFIG.profileQuestionsPerSubject ||
      !language
    ) {
      return selectedWithLocale;
    }

    const selectedWithFallback = await this.selectStrictEntProfileQuestionsFromPool(
      subjectId,
      undefined,
      seenQuestionIds,
    );
    if (selectedWithFallback.length <= selectedWithLocale.length) {
      return selectedWithLocale;
    }
    return selectedWithFallback;
  }

  private async selectStrictEntProfileQuestionsFromPool(
    subjectId: string,
    language?: string,
    seenQuestionIds?: Set<string>,
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
        answerOptions: { select: { isCorrect: true } },
        subject: { select: { slug: true } },
      },
    });
    if (questions.length === 0) return [];

    const subjectSlug = questions.find((q) => q.subject?.slug)?.subject?.slug;
    const tier1Questions = questions.filter((q) =>
      this.isStrictEntProfileTier1Question(q),
    );
    const regularIds = tier1Questions.map((q) => q.id);
    const tier2AIds = questions
      .filter((q) => this.isStrictEntProfileTier2AQuestion(q))
      .map((q) => q.id);
    const tier2BIds = questions
      .filter((q) => this.isStrictEntProfileTier2BQuestion(q))
      .map((q) => q.id);

    const orderedRegular = this.orderWithFreshFirst(regularIds, seenQuestionIds);
    const orderedTier2A = this.orderWithFreshFirst(tier2AIds, seenQuestionIds);
    const orderedTier2B = this.orderWithFreshFirst(tier2BIds, seenQuestionIds);

    const selectedTier1 =
      subjectSlug === 'informatics'
        ? this.takeUnique([orderedRegular], ENT_CONFIG.profileTier1Count)
        : this.selectProfileTier1WithTextBlock(tier1Questions, seenQuestionIds);
    const selectedTier2A = this.takeUnique(
      [orderedTier2A],
      ENT_CONFIG.profileTier2ACount,
    );
    const selectedTier2B = this.takeUnique(
      [orderedTier2B],
      ENT_CONFIG.profileTier2BCount,
    );

    return [
      ...selectedTier1,
      ...this.shuffle(selectedTier2A),
      ...this.shuffle(selectedTier2B),
    ];
  }

  private selectProfileTier1WithTextBlock(
    questions: Array<{
      id: string;
      content: unknown;
      answerOptions?: Array<{ isCorrect: boolean }>;
    }>,
    seenQuestionIds?: Set<string>,
  ): string[] {
    const textBlock = this.selectProfileTextBlock(questions, seenQuestionIds);
    if (!textBlock) {
      return this.takeUnique(
        [this.orderWithFreshFirst(questions.map((q) => q.id), seenQuestionIds)],
        ENT_CONFIG.profileTier1Count,
      );
    }

    const textBlockIds = new Set(textBlock);
    const noTextIds = questions
      .filter((q) => !textBlockIds.has(q.id) && !this.getPassageKey(q.content))
      .map((q) => q.id);
    const fallbackRegularIds = questions
      .filter((q) => !textBlockIds.has(q.id))
      .map((q) => q.id);
    const firstSlotCount = ENT_CONFIG.profileTextBlockStart - 1;
    const firstSlots = this.takeUnique(
      [
        this.orderWithFreshFirst(noTextIds, seenQuestionIds),
        this.orderWithFreshFirst(fallbackRegularIds, seenQuestionIds),
      ],
      firstSlotCount,
    );

    if (firstSlots.length < firstSlotCount) {
      return this.takeUnique(
        [this.orderWithFreshFirst(questions.map((q) => q.id), seenQuestionIds)],
        ENT_CONFIG.profileTier1Count,
      );
    }

    return [...this.shuffle(firstSlots), ...textBlock];
  }

  private selectProfileTextBlock(
    questions: Array<{ id: string; content: unknown }>,
    seenQuestionIds?: Set<string>,
  ): string[] | null {
    const groups = new Map<string, string[]>();
    for (const question of questions) {
      const key = this.getPassageKey(question.content);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), question.id]);
    }

    const candidates = [...groups.values()].filter(
      (ids) => ids.length >= ENT_CONFIG.profileTextBlockQuestionCount,
    );
    if (candidates.length === 0) return null;

    const ranked = this.shuffle(candidates).sort((a, b) => {
      const freshA = seenQuestionIds
        ? a.filter((id) => !seenQuestionIds.has(id)).length
        : a.length;
      const freshB = seenQuestionIds
        ? b.filter((id) => !seenQuestionIds.has(id)).length
        : b.length;
      return freshB - freshA;
    });

    return this.orderWithFreshFirst(ranked[0], seenQuestionIds).slice(
      0,
      ENT_CONFIG.profileTextBlockQuestionCount,
    );
  }

  private async selectStrictEntHistoryQuestions(
    subjectId: string,
    language?: string,
    seenQuestionIds?: Set<string>,
  ): Promise<string[]> {
    const selectedWithLocale = await this.selectStrictEntHistoryQuestionsFromPool(
      subjectId,
      language,
      seenQuestionIds,
    );
    const expected = ENT_CONFIG.mandatoryQuestionCounts.history_kz;
    if (selectedWithLocale.length >= expected || !language) {
      return selectedWithLocale;
    }

    const selectedWithFallback = await this.selectStrictEntHistoryQuestionsFromPool(
      subjectId,
      undefined,
      seenQuestionIds,
    );
    if (selectedWithFallback.length <= selectedWithLocale.length) {
      return selectedWithLocale;
    }
    return selectedWithFallback;
  }

  private async selectStrictEntHistoryQuestionsFromPool(
    subjectId: string,
    language?: string,
    seenQuestionIds?: Set<string>,
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

    const orderedNoText = this.orderWithFreshFirst(noTextIds, seenQuestionIds);
    const orderedText = this.orderWithFreshFirst(textIds, seenQuestionIds);

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

  /** 11–20: только вопросы с непустым контекстом в поле `passage` (строка или локализованный объект).
   *  passage может быть на верхнем уровне (e.g. `{ passage: { kk, ru } }`)
   *  или внутри языкового ключа (e.g. `{ kk: { passage, text } }`). */
  private isHistoryTextQuestion(content: unknown): boolean {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      return false;
    }
    const root = content as Record<string, unknown>;
    if (this.hasNonEmptyString(root.passage)) return true;
    for (const locale of ['kk', 'ru', 'en']) {
      const slot = root[locale];
      if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
        if (this.hasNonEmptyString((slot as Record<string, unknown>).passage)) return true;
      }
    }
    return false;
  }

  private getPassageKey(content: unknown): string | null {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      return null;
    }
    const root = content as Record<string, unknown>;
    const direct = this.firstNonEmptyString(root.passage);
    if (direct) return this.normalizePassageKey(direct);
    for (const locale of ['kk', 'ru', 'en']) {
      const slot = root[locale];
      if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
        const localized = this.firstNonEmptyString(
          (slot as Record<string, unknown>).passage,
        );
        if (localized) return this.normalizePassageKey(localized);
      }
    }
    return null;
  }

  private hasNonEmptyString(value: unknown): boolean {
    if (typeof value === 'string') return value.trim().length > 0;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.values(value as Record<string, unknown>).some(
      (child) => typeof child === 'string' && child.trim().length > 0,
    );
  }

  private firstNonEmptyString(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (typeof child === 'string' && child.trim().length > 0) {
        return child.trim();
      }
    }
    return null;
  }

  private normalizePassageKey(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private orderWithFreshFirst(
    ids: string[],
    seenQuestionIds?: Set<string>,
  ): string[] {
    if (ids.length === 0) return [];
    if (!seenQuestionIds || seenQuestionIds.size === 0) return this.shuffle([...ids]);

    const fresh = ids.filter((id) => !seenQuestionIds.has(id));
    const repeat = ids.filter((id) => seenQuestionIds.has(id));
    return [...this.shuffle(fresh), ...this.shuffle(repeat)];
  }

  private async loadSeenQuestionIds(userId?: string): Promise<Set<string> | undefined> {
    if (!userId) return undefined;
    const rows = await this.prisma.testAnswer.findMany({
      where: { session: { userId } },
      distinct: ['questionId'],
      select: { questionId: true },
    });
    return new Set(rows.map((row) => row.questionId));
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
