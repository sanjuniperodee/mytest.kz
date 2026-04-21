import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TestGeneratorService } from './test-generator.service';
import { TestScorerService } from './test-scorer.service';
import { MistakesService } from './mistakes.service';
import { ENT_TRIAL_LIMIT } from '../billing/billing.config';

@Injectable()
export class TestSessionService {
  constructor(
    private prisma: PrismaService,
    private generator: TestGeneratorService,
    private scorer: TestScorerService,
    private mistakes: MistakesService,
  ) {}

  private normalizeScoreValue(score: unknown): number | null {
    if (score === null || score === undefined) return null;
    const normalized = Number(score);
    return Number.isFinite(normalized) ? normalized : null;
  }

  private normalizeSessionScore<T extends { score: unknown }>(
    session: T,
  ): Omit<T, 'score'> & { score: number | null } {
    return {
      ...session,
      score: this.normalizeScoreValue(session.score),
    };
  }

  async startTest(
    userId: string,
    templateId: string,
    language: string,
    profileSubjectIds?: string[],
    entScope?: 'mandatory' | 'profile' | 'full',
  ) {
    const template = await this.prisma.testTemplate.findUnique({
      where: { id: templateId },
      include: { sections: true, examType: true },
    });

    if (!template) throw new NotFoundException('Template not found');

    const examSlug = (template.examType as { slug?: string }).slug ?? '';

    if (examSlug === 'ent') {
      const now = new Date();
      const activeSubscription = await this.prisma.subscription.findFirst({
        where: {
          userId,
          isActive: true,
          startsAt: { lte: now },
          expiresAt: { gt: now },
        },
      });

      let hasValidSubscription = false;
      if (activeSubscription) {
        if (activeSubscription.planType === 'trial') {
          const testsTakenWithTrial = await this.prisma.testSession.count({
            where: {
              userId,
              examType: { slug: 'ent' },
              startedAt: { gte: activeSubscription.startsAt },
            },
          });
          if (testsTakenWithTrial < 1) hasValidSubscription = true;
        } else {
          hasValidSubscription = true;
        }
      }

      if (!hasValidSubscription) {
        const consumed = await this.prisma.user.updateMany({
          where: {
            id: userId,
            entTrialUsed: { lt: ENT_TRIAL_LIMIT },
          },
          data: {
            entTrialUsed: { increment: 1 },
          },
        });
        if (consumed.count === 0) {
          throw new BadRequestException('TRIAL_LIMIT_EXCEEDED');
        }
      }
    }

    let resolvedEntScope = entScope;
    if (examSlug === 'ent') {
      if (!resolvedEntScope) {
        const n = profileSubjectIds?.length ?? 0;
        if (n === 0) resolvedEntScope = 'mandatory';
        else if (n === 2) resolvedEntScope = 'full';
        else {
          throw new BadRequestException(
            'ENT: укажите entScope (mandatory | profile | full) или 0 / 2 профильных предмета',
          );
        }
      }
      if (resolvedEntScope === 'mandatory') {
        profileSubjectIds = undefined;
      } else if (
        resolvedEntScope === 'profile' ||
        resolvedEntScope === 'full'
      ) {
        if (!profileSubjectIds || profileSubjectIds.length !== 2) {
          throw new BadRequestException(
            'Для этого режима ЕНТ нужно ровно 2 профильных предмета',
          );
        }
      }
    } else {
      resolvedEntScope = undefined;
    }

    // Validate profile subjects belong to this exam type
    if (profileSubjectIds && profileSubjectIds.length > 0) {
      const validSubjects = await this.prisma.subject.findMany({
        where: {
          id: { in: profileSubjectIds },
          examTypeId: template.examTypeId,
          isMandatory: false,
        },
        select: { id: true },
      });

      const validIds = new Set(validSubjects.map((s) => s.id));
      for (const id of profileSubjectIds) {
        if (!validIds.has(id)) {
          throw new BadRequestException(`Invalid profile subject: ${id}`);
        }
      }
    }

    const mandatoryQuestionSum = template.sections.reduce(
      (s, sec) => s + sec.questionCount,
      0,
    );
    const profileQuestionCount = this.getProfileQuestionCount(
      examSlug,
      mandatoryQuestionSum,
    );

    // Generate questions with sections
    const sections = await this.generator.generateFromTemplate(
      templateId,
      profileSubjectIds,
      profileQuestionCount,
      userId,
      language,
      examSlug === 'ent' && resolvedEntScope
        ? { entScope: resolvedEntScope }
        : undefined,
    );

    // Flatten question IDs maintaining section order
    const allAnswerData: { questionId: string; sectionIndex: number }[] = [];
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      for (const qId of sections[sIdx].questionIds) {
        allAnswerData.push({ questionId: qId, sectionIndex: sIdx });
      }
    }

    const totalQuestions = allAnswerData.length;

    const mandatoryQ = template.sections.reduce(
      (acc, s) => acc + s.questionCount,
      0,
    );
    const fullEntQ = mandatoryQ + 2 * profileQuestionCount;
    const sessionDurationMins =
      examSlug === 'ent' && fullEntQ > 0
        ? Math.max(
            5,
            Math.round(template.durationMins * (totalQuestions / fullEntQ)),
          )
        : template.durationMins;

    // Build metadata with section info
    const sectionsMeta = await Promise.all(
      sections.map(async (sec) => {
        const subject = await this.prisma.subject.findUnique({
          where: { id: sec.subjectId },
          select: { id: true, name: true, slug: true, isMandatory: true },
        });
        return {
          subjectId: sec.subjectId,
          subjectName: subject?.name,
          subjectSlug: subject?.slug,
          isMandatory: subject?.isMandatory ?? true,
          questionCount: sec.questionIds.length,
          sortOrder: sec.sortOrder,
          profileHeavyFrom: sec.profileHeavyFrom ?? null,
        };
      }),
    );

    // Create session
    const session = await this.prisma.testSession.create({
      data: {
        userId,
        templateId,
        examTypeId: template.examTypeId,
        language,
        totalQuestions,
        timeRemaining: sessionDurationMins * 60,
        metadata: {
          sections: sectionsMeta,
          profileSubjectIds: profileSubjectIds || [],
          questionOrder: allAnswerData.map((a) => a.questionId),
          ...(examSlug === 'ent' && resolvedEntScope
            ? { entScope: resolvedEntScope }
            : {}),
          ...(examSlug === 'ent' &&
          resolvedEntScope &&
          resolvedEntScope !== 'full'
            ? { entSessionDurationMins: sessionDurationMins }
            : {}),
        },
        answers: {
          create: allAnswerData.map((a) => ({
            questionId: a.questionId,
            selectedIds: [],
          })),
        },
      } as any,
      include: {
        examType: true,
        answers: {
          include: {
            question: {
              include: {
                subject: { select: { id: true, name: true, slug: true } },
                answerOptions: {
                  select: { id: true, content: true, sortOrder: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    return this.normalizeSessionScore(session);
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.testSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        examType: true,
        answers: {
          include: {
            question: {
              include: {
                subject: { select: { id: true, name: true, slug: true } },
                answerOptions: {
                  select: { id: true, content: true, sortOrder: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Session not found');

    // Calculate real time remaining (template-based or remediation metadata)
    if (session.status === 'in_progress') {
      const durationMins = await this.getDurationMinsForSession(session);
      if (durationMins != null) {
        const elapsed = Math.floor(
          (Date.now() - session.startedAt.getTime()) / 1000,
        );
        const remaining = durationMins * 60 - elapsed;

        if (remaining <= 0) {
          await this.finishTest(sessionId, userId, true);
          session.status = 'timed_out';
          session.timeRemaining = 0;
        } else {
          session.timeRemaining = remaining;
        }
      }
    }

    return this.normalizeSessionScore(session);
  }

  async getSessions(userId: string, page = 1, limit = 10) {
    const [items, total] = await Promise.all([
      this.prisma.testSession.findMany({
        where: { userId },
        include: { examType: true },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.testSession.count({ where: { userId } }),
    ]);

    return {
      items: items.map((item) => this.normalizeSessionScore(item)),
      total,
      page,
      limit,
    };
  }

  async submitAnswer(
    sessionId: string,
    userId: string,
    questionId: string,
    selectedIds: string[],
  ) {
    const session = await this.prisma.testSession.findFirst({
      where: { id: sessionId, userId, status: 'in_progress' },
    });

    if (!session) throw new BadRequestException('Session not available');

    const durationMins = await this.getDurationMinsForSession(session);
    if (durationMins != null) {
      const elapsed = Math.floor(
        (Date.now() - session.startedAt.getTime()) / 1000,
      );
      if (elapsed > durationMins * 60) {
        await this.finishTest(sessionId, userId, true);
        throw new BadRequestException('Time expired');
      }
    }

    const answer = await this.prisma.testAnswer.findFirst({
      where: { sessionId, questionId },
    });

    if (!answer) throw new NotFoundException('Question not in this test');

    return this.prisma.testAnswer.update({
      where: { id: answer.id },
      data: {
        selectedIds,
        answeredAt: new Date(),
      },
    });
  }

  async finishTest(sessionId: string, userId: string, timedOut = false) {
    const session = await this.prisma.testSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'in_progress') {
      throw new BadRequestException('Test already finished');
    }

    const scoreResult = await this.scorer.calculateScore(sessionId);

    const elapsed = Math.floor(
      (Date.now() - session.startedAt.getTime()) / 1000,
    );

    const updated = await this.prisma.testSession.update({
      where: { id: sessionId },
      data: {
        status: timedOut ? 'timed_out' : 'completed',
        finishedAt: new Date(),
        durationSecs: elapsed,
        timeRemaining: 0,
        correctCount: scoreResult.correctCount,
        rawScore: scoreResult.rawScore,
        maxScore: scoreResult.maxScore,
        score: scoreResult.score,
      },
    });
    return this.normalizeSessionScore(updated);
  }

  async getReview(sessionId: string, userId: string) {
    const session = await this.prisma.testSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: { in: ['completed', 'timed_out'] },
      },
      include: {
        examType: true,
        answers: {
          include: {
            question: {
              include: {
                subject: { select: { id: true, name: true, slug: true } },
                answerOptions: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Session not found or not finished');

    return this.normalizeSessionScore(session);
  }

  async getExplanation(sessionId: string, userId: string, questionId: string) {
    const answer = await this.prisma.testAnswer.findFirst({
      where: { sessionId, questionId },
      include: {
        session: true,
        question: true,
      },
    });

    if (!answer || answer.session.userId !== userId) {
      throw new NotFoundException('Not found');
    }

    return {
      questionId,
      explanation: (answer.question as any).explanation,
    };
  }

  async startRemediationSession(
    userId: string,
    language: string,
    options?: { examTypeId?: string; limit?: number; durationMins?: number },
  ) {
    const capped = Math.min(Math.max(options?.limit ?? 15, 1), 40);
    const durationMins = options?.durationMins ?? 45;

    const latest = await this.mistakes.getLatestOutcomes(userId);
    const openRows = latest.filter((r) => !r.isCorrect);
    if (openRows.length === 0) {
      throw new BadRequestException('NO_OPEN_MISTAKES');
    }

    let resolvedExamTypeId = options?.examTypeId;
    if (!resolvedExamTypeId) {
      const types = new Set(openRows.map((r) => r.examTypeId));
      if (types.size > 1) {
        throw new BadRequestException('EXAM_TYPE_REQUIRED');
      }
      resolvedExamTypeId = [...types][0];
    }

    const questionIdsAll = this.mistakes.getOpenMistakeQuestionIds(
      latest,
      resolvedExamTypeId,
    );
    this.shuffleInPlace(questionIdsAll);
    const questionIds = questionIdsAll.slice(0, capped);

    const questionRows = await this.prisma.question.findMany({
      where: {
        id: { in: questionIds },
        isActive: true,
        examTypeId: resolvedExamTypeId,
      },
      include: {
        subject: {
          select: { id: true, name: true, slug: true, isMandatory: true },
        },
      },
    });

    const byId = new Map(questionRows.map((q) => [q.id, q]));
    const ordered = questionIds
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => !!q);

    if (ordered.length === 0) {
      throw new BadRequestException('NO_OPEN_MISTAKES');
    }

    const sectionsMeta: {
      subjectId: string;
      subjectName: unknown;
      subjectSlug: string;
      isMandatory: boolean;
      questionCount: number;
      sortOrder: number;
      profileHeavyFrom: number | null;
    }[] = [];

    let lastSubjectId: string | null = null;
    for (const q of ordered) {
      const sub = q.subject;
      if (q.subjectId !== lastSubjectId) {
        lastSubjectId = q.subjectId;
        sectionsMeta.push({
          subjectId: sub.id,
          subjectName: sub.name,
          subjectSlug: sub.slug,
          isMandatory: sub.isMandatory ?? true,
          questionCount: 0,
          sortOrder: sectionsMeta.length,
          profileHeavyFrom: sub.isMandatory ? null : 31,
        });
      }
      sectionsMeta[sectionsMeta.length - 1].questionCount++;
    }

    const session = await this.prisma.testSession.create({
      data: {
        userId,
        templateId: null,
        examTypeId: resolvedExamTypeId,
        language,
        totalQuestions: ordered.length,
        timeRemaining: durationMins * 60,
        metadata: {
          kind: 'remediation',
          remediationDurationMins: durationMins,
          sections: sectionsMeta,
          profileSubjectIds: [],
          questionOrder: ordered.map((q) => q.id),
        },
        answers: {
          create: ordered.map((q) => ({
            questionId: q.id,
            selectedIds: [],
          })),
        },
      } as any,
      include: {
        examType: true,
        answers: {
          include: {
            question: {
              include: {
                subject: { select: { id: true, name: true, slug: true } },
                answerOptions: {
                  select: { id: true, content: true, sortOrder: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    return this.normalizeSessionScore(session);
  }

  private shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private async getDurationMinsForSession(session: {
    templateId: string | null;
    metadata: unknown;
  }): Promise<number | null> {
    const meta = (session.metadata || {}) as {
      kind?: string;
      remediationDurationMins?: number;
      entSessionDurationMins?: number;
    };
    if (
      meta.kind === 'remediation' &&
      typeof meta.remediationDurationMins === 'number' &&
      Number.isFinite(meta.remediationDurationMins)
    ) {
      return meta.remediationDurationMins;
    }
    if (
      typeof meta.entSessionDurationMins === 'number' &&
      Number.isFinite(meta.entSessionDurationMins)
    ) {
      return meta.entSessionDurationMins;
    }
    if (session.templateId) {
      const template = await this.prisma.testTemplate.findUnique({
        where: { id: session.templateId },
      });
      return template?.durationMins ?? null;
    }
    return null;
  }

  /**
   * ЕНТ: полный пробник (≥35 обязательных вопросов в шаблоне) — 40 профильных на предмет;
   * укороченные шаблоны — 20 или 10, чтобы сессия не раздувалась.
   */
  private getProfileQuestionCount(
    examSlug: string,
    mandatoryQuestionSum: number,
  ): number {
    if (examSlug === 'ent') {
      if (mandatoryQuestionSum >= 35) return 40;
      if (mandatoryQuestionSum >= 20) return 20;
      return 10;
    }
    if (examSlug === 'nuet') return 15;
    return 10;
  }
}
