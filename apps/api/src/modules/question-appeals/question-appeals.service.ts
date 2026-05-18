import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestionAppealReason, QuestionAppealStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QUESTION_METADATA_LOCALE_KEY } from '../../common/question-locale';
import { extractSlot, previewFromSlot } from '../../common/question-similarity';

type AppealWithRelations = Prisma.QuestionAppealGetPayload<{
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
    session: {
      select: {
        id: true;
        status: true;
        language: true;
        startedAt: true;
        finishedAt: true;
      };
    };
    question: {
      select: {
        id: true;
        content: true;
        metadata: true;
        explanation: true;
        imageUrls: true;
        type: true;
        difficulty: true;
        scoreWeight: true;
      };
    };
    subject: {
      select: {
        id: true;
        slug: true;
        name: true;
      };
    };
    examType: {
      select: {
        id: true;
        slug: true;
        name: true;
      };
    };
  };
}>;

@Injectable()
export class QuestionAppealsService {
  constructor(private readonly prisma: PrismaService) {}

  private trimToNull(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private pickQuestionPreview(content: unknown, metadata: unknown): string {
    const metadataRecord =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : null;
    const locale = metadataRecord?.[QUESTION_METADATA_LOCALE_KEY] === 'kk' ? 'kk' : 'ru';
    const slot =
      extractSlot(content, locale) ??
      extractSlot(content, locale === 'ru' ? 'kk' : 'ru') ??
      extractSlot(content, 'en');
    return previewFromSlot(slot, 180) || 'Без превью';
  }

  private formatAppeal(appeal: AppealWithRelations) {
    return {
      id: appeal.id,
      userId: appeal.userId,
      sessionId: appeal.sessionId,
      questionId: appeal.questionId,
      examTypeId: appeal.examTypeId,
      subjectId: appeal.subjectId,
      reason: appeal.reason,
      message: appeal.message,
      status: appeal.status,
      adminNote: appeal.adminNote,
      reviewedAt: appeal.reviewedAt,
      createdAt: appeal.createdAt,
      updatedAt: appeal.updatedAt,
      questionPreview: this.pickQuestionPreview(
        appeal.question?.content ?? null,
        appeal.question?.metadata ?? null,
      ),
      user: appeal.user,
      reviewer: appeal.reviewer,
      session: appeal.session,
      question: appeal.question,
      subject: appeal.subject,
      examType: appeal.examType,
      questionSnapshot: appeal.questionSnapshot,
    };
  }

  private async loadSessionQuestion(userId: string, sessionId: string, questionId: string) {
    const session = await this.prisma.testSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: { in: ['in_progress', 'completed', 'timed_out'] },
      },
      include: {
        answers: {
          where: { questionId },
          include: {
            question: {
              include: {
                examType: {
                  select: { id: true, slug: true, name: true },
                },
                subject: {
                  select: { id: true, slug: true, name: true },
                },
                answerOptions: {
                  select: {
                    id: true,
                    content: true,
                    isCorrect: true,
                    sortOrder: true,
                  },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const answer = session.answers[0];
    if (!answer) {
      throw new NotFoundException('Question not found in session');
    }

    return { session, answer, question: answer.question };
  }

  private buildSnapshot(context: Awaited<ReturnType<QuestionAppealsService['loadSessionQuestion']>>) {
    return {
      session: {
        id: context.session.id,
        status: context.session.status,
        language: context.session.language,
        startedAt: context.session.startedAt,
        finishedAt: context.session.finishedAt,
        metadata: context.session.metadata,
      },
      answer: {
        id: context.answer.id,
        selectedIds: context.answer.selectedIds,
        isCorrect: context.answer.isCorrect,
        answeredAt: context.answer.answeredAt,
        timeSpentSecs: context.answer.timeSpentSecs,
      },
      examType: context.question.examType,
      subject: context.question.subject,
      question: {
        id: context.question.id,
        type: context.question.type,
        difficulty: context.question.difficulty,
        scoreWeight: context.question.scoreWeight,
        content: context.question.content,
        explanation: context.question.explanation,
        imageUrls: context.question.imageUrls,
        metadata: context.question.metadata,
        answerOptions: context.question.answerOptions,
      },
    } as Prisma.InputJsonValue;
  }

  async submit(userId: string, sessionId: string, questionId: string, data: {
    reason: QuestionAppealReason;
    message: string;
  }) {
    const message = this.trimToNull(data.message);
    if (!message || message.length < 12) {
      throw new BadRequestException('Опишите причину апелляции подробнее');
    }

    const context = await this.loadSessionQuestion(userId, sessionId, questionId);
    const snapshot = this.buildSnapshot(context);

    const appeal = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.questionAppeal.findUnique({
        where: {
          userId_sessionId_questionId: {
            userId,
            sessionId,
            questionId,
          },
        },
      });

      if (!existing) {
        return tx.questionAppeal.create({
          data: {
            userId,
            sessionId,
            questionId,
            examTypeId: context.question.examTypeId,
            subjectId: context.question.subjectId,
            reason: data.reason,
            message,
            questionSnapshot: snapshot,
          },
          include: this.includeConfig(),
        });
      }

      if (existing.status !== QuestionAppealStatus.pending) {
        throw new ConflictException('Апелляция по этому вопросу уже отправлена и обрабатывается');
      }

      return tx.questionAppeal.update({
        where: { id: existing.id },
        data: {
          reason: data.reason,
          message,
          questionSnapshot: snapshot,
        },
        include: this.includeConfig(),
      });
    });

    return this.formatAppeal(appeal);
  }

  async listForSession(userId: string, sessionId: string) {
    const session = await this.prisma.testSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: { in: ['in_progress', 'completed', 'timed_out'] },
      },
      select: { id: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const appeals = await this.prisma.questionAppeal.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: 'desc' },
      include: this.includeConfig(),
    });

    return appeals.map((appeal) => this.formatAppeal(appeal));
  }

  async listAdmin(filters: {
    page?: number;
    limit?: number;
    status?: QuestionAppealStatus;
    reason?: QuestionAppealReason;
    examTypeId?: string;
    subjectId?: string;
    search?: string;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const search = this.trimToNull(filters.search);
    const looksLikeUuid =
      !!search &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        search,
      );
    const where: Prisma.QuestionAppealWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.reason) where.reason = filters.reason;
    if (filters.examTypeId) where.examTypeId = filters.examTypeId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { adminNote: { contains: search, mode: 'insensitive' } },
        ...(looksLikeUuid
          ? [{ questionId: search }, { sessionId: search }, { userId: search }]
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
        this.prisma.questionAppeal.findMany({
          where,
          include: this.includeConfig(),
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.questionAppeal.count({ where }),
        this.prisma.questionAppeal.count({
          where: { ...where, status: QuestionAppealStatus.pending },
        }),
        this.prisma.questionAppeal.count({
          where: { ...where, status: QuestionAppealStatus.under_review },
        }),
        this.prisma.questionAppeal.count({
          where: { ...where, status: QuestionAppealStatus.resolved },
        }),
        this.prisma.questionAppeal.count({
          where: { ...where, status: QuestionAppealStatus.rejected },
        }),
      ]);

    return {
      items: items.map((appeal) => this.formatAppeal(appeal)),
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

  async updateAdmin(
    id: string,
    adminId: string,
    data: { status?: QuestionAppealStatus; adminNote?: string },
  ) {
    const existing = await this.prisma.questionAppeal.findUnique({
      where: { id },
      include: this.includeConfig(),
    });

    if (!existing) {
      throw new NotFoundException('Appeal not found');
    }

    const nextStatus = data.status ?? existing.status;
    const adminNote = data.adminNote === undefined
      ? existing.adminNote
      : this.trimToNull(data.adminNote);

    if (
      (nextStatus === QuestionAppealStatus.resolved ||
        nextStatus === QuestionAppealStatus.rejected) &&
      !adminNote
    ) {
      throw new BadRequestException('Добавьте комментарий администратора перед финальным решением');
    }

    const finalState =
      nextStatus === QuestionAppealStatus.resolved ||
      nextStatus === QuestionAppealStatus.rejected;

    const updated = await this.prisma.questionAppeal.update({
      where: { id },
      data: {
        status: nextStatus,
        adminNote,
        reviewedBy: finalState ? adminId : null,
        reviewedAt: finalState ? new Date() : null,
      },
      include: this.includeConfig(),
    });

    return this.formatAppeal(updated);
  }

  private includeConfig() {
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
      session: {
        select: {
          id: true,
          status: true,
          language: true,
          startedAt: true,
          finishedAt: true,
        },
      },
      question: {
        select: {
          id: true,
          content: true,
          metadata: true,
          explanation: true,
          imageUrls: true,
          type: true,
          difficulty: true,
          scoreWeight: true,
        },
      },
      subject: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      examType: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    } satisfies Prisma.QuestionAppealInclude;
  }
}
