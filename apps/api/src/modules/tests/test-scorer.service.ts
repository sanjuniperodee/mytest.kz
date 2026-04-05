import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface SectionScore {
  subjectId: string;
  subjectName: unknown;
  subjectSlug: string;
  correctCount: number;
  totalCount: number;
  score: number;
}

interface ScoreResult {
  correctCount: number;
  rawScore: number;
  maxScore: number;
  score: number; // percentage
  sections: SectionScore[];
}

@Injectable()
export class TestScorerService {
  constructor(private prisma: PrismaService) {}

  async calculateScore(sessionId: string): Promise<ScoreResult> {
    const session = await this.prisma.testSession.findUnique({
      where: { id: sessionId },
      include: {
        examType: true,
        answers: {
          include: {
            question: {
              include: {
                answerOptions: true,
                subject: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
      },
    });

    if (!session) throw new Error('Session not found');

    let correctCount = 0;
    const totalQuestions = session.answers.length;

    // Track per-section stats
    const sectionMap = new Map<string, {
      subjectId: string;
      subjectName: unknown;
      subjectSlug: string;
      correctCount: number;
      totalCount: number;
    }>();

    // Grade each answer
    for (const answer of session.answers) {
      const correctOptionIds = answer.question.answerOptions
        .filter((o) => o.isCorrect)
        .map((o) => o.id);

      const selectedIds = answer.selectedIds;

      const isCorrect =
        selectedIds.length > 0 &&
        selectedIds.length === correctOptionIds.length &&
        selectedIds.every((id) => correctOptionIds.includes(id));

      if (isCorrect) correctCount++;

      await this.prisma.testAnswer.update({
        where: { id: answer.id },
        data: { isCorrect },
      });

      // Track section score
      const subject = (answer.question as any).subject;
      const subjectId = subject?.id || answer.question.subjectId;
      if (!sectionMap.has(subjectId)) {
        sectionMap.set(subjectId, {
          subjectId,
          subjectName: subject?.name,
          subjectSlug: subject?.slug || '',
          correctCount: 0,
          totalCount: 0,
        });
      }
      const sec = sectionMap.get(subjectId)!;
      sec.totalCount++;
      if (isCorrect) sec.correctCount++;
    }

    // Scoring depends on exam type
    const examSlug = (session.examType as any).slug;
    const { rawScore, maxScore } = this.calculateRawScore(
      examSlug,
      correctCount,
      totalQuestions,
    );

    const score = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;

    // Build section scores
    const sections: SectionScore[] = Array.from(sectionMap.values()).map((sec) => ({
      subjectId: sec.subjectId,
      subjectName: sec.subjectName,
      subjectSlug: sec.subjectSlug,
      correctCount: sec.correctCount,
      totalCount: sec.totalCount,
      score: sec.totalCount > 0
        ? Math.round((sec.correctCount / sec.totalCount) * 100 * 100) / 100
        : 0,
    }));

    return {
      correctCount,
      rawScore,
      maxScore,
      score: Math.round(score * 100) / 100,
      sections,
    };
  }

  private calculateRawScore(
    examSlug: string,
    correctCount: number,
    totalQuestions: number,
  ): { rawScore: number; maxScore: number } {
    switch (examSlug) {
      case 'ent':
        // ENT: 1 балл за правильный ответ, макс = общее кол-во
        return { rawScore: correctCount, maxScore: totalQuestions };

      case 'nuet':
        // NUET: аналогичная система
        return { rawScore: correctCount, maxScore: totalQuestions };

      default:
        return { rawScore: correctCount, maxScore: totalQuestions };
    }
  }
}
