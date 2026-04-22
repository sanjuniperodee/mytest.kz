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
        const questionIds = await this.selectQuestions(
          section.subjectId,
          section.questionCount,
          section.selectionMode,
          userId,
          language,
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

        const questionIds = await this.selectQuestions(
          subjectId,
          profileQuestionCount,
          'random',
          userId,
          language,
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
  ): Promise<string[]> {
    const localeWhere = questionWhereForTestLanguage(language);
    const baseWhere = {
      AND: [{ subjectId }, { isActive: true }, localeWhere],
    };
    if (selectionMode === 'random') {
      const questions = await this.prisma.question.findMany({
        where: baseWhere,
        select: { id: true },
      });
      if (questions.length === 0) return [];

      const ids = questions.map((q) => q.id);
      let ordered: string[];
      if (userId) {
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
        ordered = [...this.shuffle(fresh), ...this.shuffle(repeat)];
      } else {
        ordered = this.shuffle([...ids]);
      }
      return ordered.slice(0, count);
    } else {
      const questions = await this.prisma.question.findMany({
        where: baseWhere,
        select: { id: true },
        take: count,
        orderBy: { createdAt: 'asc' },
      });
      return questions.map((q) => q.id);
    }
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
