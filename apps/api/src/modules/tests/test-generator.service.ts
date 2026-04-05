import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface GeneratedSection {
  subjectId: string;
  questionIds: string[];
  sortOrder: number;
}

@Injectable()
export class TestGeneratorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate questions from a template.
   * If profileSubjectIds are provided, they are added as extra sections
   * (for exams like ENT where user picks 2 profile subjects).
   */
  async generateFromTemplate(
    templateId: string,
    profileSubjectIds?: string[],
    profileQuestionCount = 20,
  ): Promise<GeneratedSection[]> {
    const template = await this.prisma.testTemplate.findUnique({
      where: { id: templateId },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!template) throw new Error('Template not found');

    const sections: GeneratedSection[] = [];

    // Generate from template sections (mandatory blocks)
    for (const section of template.sections) {
      const questionIds = await this.selectQuestions(
        section.subjectId,
        section.questionCount,
        section.selectionMode,
      );
      sections.push({
        subjectId: section.subjectId,
        questionIds,
        sortOrder: section.sortOrder,
      });
    }

    // Add profile subject sections if provided
    if (profileSubjectIds && profileSubjectIds.length > 0) {
      const lastSortOrder = sections.length > 0
        ? Math.max(...sections.map((s) => s.sortOrder))
        : 0;

      for (let i = 0; i < profileSubjectIds.length; i++) {
        const subjectId = profileSubjectIds[i];
        // Skip if already in template
        if (sections.some((s) => s.subjectId === subjectId)) continue;

        const questionIds = await this.selectQuestions(
          subjectId,
          profileQuestionCount,
          'random',
        );
        sections.push({
          subjectId,
          questionIds,
          sortOrder: lastSortOrder + i + 1,
        });
      }
    }

    return sections;
  }

  private async selectQuestions(
    subjectId: string,
    count: number,
    selectionMode: string,
  ): Promise<string[]> {
    if (selectionMode === 'random') {
      const questions = await this.prisma.question.findMany({
        where: { subjectId, isActive: true },
        select: { id: true },
      });

      const shuffled = this.shuffle(questions);
      return shuffled.slice(0, count).map((q) => q.id);
    } else {
      const questions = await this.prisma.question.findMany({
        where: { subjectId, isActive: true },
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
