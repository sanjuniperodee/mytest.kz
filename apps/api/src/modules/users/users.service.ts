import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { ENT_TRIAL_LIMIT } from '../billing/billing.config';
import { ENT_CONFIG } from '@bilimland/shared';
import { AccessService } from '../subscriptions/access.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private telegramBot: TelegramBotService,
    private accessService: AccessService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    // Re-check channel membership:
    // - Always re-check if currently false (user might have just subscribed)
    // - If true, cache for 5 min to avoid spamming Telegram API
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    let isChannelMember = user.isChannelMember;

    const shouldRecheck = !isChannelMember || !user.channelCheckedAt || user.channelCheckedAt < fiveMinAgo;
    if (shouldRecheck) {
      isChannelMember = await this.telegramBot.checkChannelMembership(
        Number(user.telegramId),
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isChannelMember, channelCheckedAt: new Date() },
      });
    }

    const accessByExam = await this.accessService.getUserAccessByExam(userId);
    const entAccess = accessByExam.find((x) => x.examSlug === 'ent');
    const activePaidAccess = accessByExam.some((x) => x.hasPaidTier && x.hasAccess);

    const freeLimit = ENT_TRIAL_LIMIT;
    const freeUsed = Math.max(0, user.entTrialUsed);
    const freeRemaining = Math.max(0, freeLimit - freeUsed);
    const totalRemainingFromAccess =
      entAccess?.total.remaining != null ? Math.max(0, entAccess.total.remaining) : 0;
    const paidTrialRemaining = Math.max(0, totalRemainingFromAccess - freeRemaining);
    const paidTrialLimit = paidTrialRemaining;
    const paidTrialUsed = 0;
    const totalLimit = freeLimit + paidTrialLimit;
    const totalUsed = freeUsed + paidTrialUsed;
    const totalRemaining = freeRemaining + paidTrialRemaining;

    return {
      id: user.id,
      telegramId: Number(user.telegramId),
      telegramUsername: user.telegramUsername,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      preferredLanguage: user.preferredLanguage,
      timezone: user.timezone,
      isAdmin: user.isAdmin,
      isChannelMember,
      // Premium in UI means paid plan; trial should not show "unlimited".
      hasActiveSubscription: activePaidAccess,
      accessByExam,
      trialStatus: {
        ent: {
          limit: totalLimit,
          used: totalUsed,
          remaining: totalRemaining,
          exhausted: totalRemaining <= 0,
          freeLimit,
          freeUsed,
          freeRemaining,
          paidTrialLimit,
          paidTrialUsed,
          paidTrialRemaining,
          totalLimit,
          totalUsed,
          totalRemaining,
        },
      },
    };
  }

  async updateProfile(
    userId: string,
    data: { preferredLanguage?: string; timezone?: string },
  ) {
    if (data.preferredLanguage) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { preferredLanguage: data.preferredLanguage },
      });
    }
    if (data.timezone) {
      await this.accessService.updateUserTimezone(userId, data.timezone);
    }
    return this.getProfile(userId);
  }

  async getStats(userId: string) {
    const finishedStatuses = ['completed', 'timed_out'] as const;

    const [finishedSessions, inProgressSessions] = await Promise.all([
      this.prisma.testSession.findMany({
        where: { userId, status: { in: [...finishedStatuses] } },
        include: {
          examType: { select: { id: true, slug: true, name: true } },
        },
      }),
      this.prisma.testSession.findMany({
        where: { userId, status: 'in_progress' },
        include: {
          examType: { select: { id: true, slug: true, name: true } },
        },
      }),
    ]);

    const isEntSessionEligibleForStats = (session: {
      examType: { slug: string } | null;
      totalQuestions: number;
      maxScore: number | null;
      status: string;
    }) => {
      if (session.examType?.slug !== 'ent') return true;
      if (session.totalQuestions !== ENT_CONFIG.totalQuestions) return false;
      if (session.status === 'in_progress') return true;
      return (
        session.maxScore != null &&
        Number.isFinite(Number(session.maxScore)) &&
        Math.round(Number(session.maxScore)) === ENT_CONFIG.maxTotalPoints
      );
    };

    const analyticsFinishedSessions = finishedSessions.filter(isEntSessionEligibleForStats);
    const analyticsInProgressSessions = inProgressSessions.filter(isEntSessionEligibleForStats);

    type BestSessionPoints = { score: number; raw: number; max: number };

    type ExamAgg = {
      examTypeId: string;
      examSlug: string;
      examName: unknown;
      scores: number[];
      durations: number[];
      correctPct: number[];
      finishedAts: Date[];
      /** Лучшая попытка по проценту (при равенстве % — больший сырой балл). */
      bestByPoints: BestSessionPoints | null;
    };

    const byExam = new Map<string, ExamAgg>();
    const finishedByExam = new Map<string, typeof finishedSessions>();

    const ensureAgg = (session: {
      examTypeId: string;
      examType: { slug: string; name: unknown } | null;
    }): ExamAgg => {
      const id = session.examTypeId;
      if (!byExam.has(id)) {
        byExam.set(id, {
          examTypeId: id,
          examSlug: session.examType?.slug ?? '',
          examName: session.examType?.name ?? null,
          scores: [],
          durations: [],
          correctPct: [],
          finishedAts: [],
          bestByPoints: null,
        });
      }
      return byExam.get(id)!;
    };

    for (const s of analyticsFinishedSessions) {
      const agg = ensureAgg(s);
      if (s.examType) {
        agg.examSlug = s.examType.slug;
        agg.examName = s.examType.name;
      }
      const sc = Number(s.score);
      if (Number.isFinite(sc)) {
        agg.scores.push(sc);
        const maxRaw =
          s.maxScore != null && Number(s.maxScore) > 0
            ? Math.round(Number(s.maxScore))
            : s.totalQuestions > 0
              ? s.totalQuestions
              : null;
        const rawVal =
          s.rawScore != null
            ? Number(s.rawScore)
            : s.correctCount != null
              ? s.correctCount
              : null;
        if (maxRaw != null && maxRaw > 0 && rawVal != null && Number.isFinite(rawVal)) {
          const raw = Math.round(rawVal);
          const candidate = { score: sc, raw, max: maxRaw };
          const prev = agg.bestByPoints;
          if (
            !prev ||
            candidate.score > prev.score ||
            (candidate.score === prev.score && candidate.raw > prev.raw)
          ) {
            agg.bestByPoints = candidate;
          }
        }
      }
      if (s.durationSecs != null && s.durationSecs > 0) {
        agg.durations.push(s.durationSecs);
      }
      if (s.correctCount != null && s.totalQuestions > 0) {
        agg.correctPct.push((s.correctCount / s.totalQuestions) * 100);
      }
      if (s.finishedAt) {
        agg.finishedAts.push(s.finishedAt);
      }
      const list = finishedByExam.get(s.examTypeId) ?? [];
      list.push(s);
      finishedByExam.set(s.examTypeId, list);
    }

    const inProgressByExam = new Map<string, number>();
    for (const s of analyticsInProgressSessions) {
      const agg = ensureAgg(s);
      if (s.examType) {
        if (!agg.examSlug) agg.examSlug = s.examType.slug;
        if (agg.examName == null) agg.examName = s.examType.name;
      }
      inProgressByExam.set(s.examTypeId, (inProgressByExam.get(s.examTypeId) ?? 0) + 1);
    }

    const withScore = analyticsFinishedSessions.filter((s) =>
      Number.isFinite(Number(s.score)),
    );
    const totalTests = withScore.length;
    const averageScore =
      totalTests > 0
        ? withScore.reduce((sum, s) => sum + Number(s.score), 0) / totalTests
        : 0;

    const byExamType = Array.from(byExam.values())
      .map((agg) => {
        const n = agg.scores.length;
        const avg = n > 0 ? agg.scores.reduce((a, b) => a + b, 0) / n : 0;
        const list = finishedByExam.get(agg.examTypeId) ?? [];
        const scoredChrono = list
          .filter((x) => Number.isFinite(Number(x.score)) && x.finishedAt)
          .sort((a, b) => a.finishedAt!.getTime() - b.finishedAt!.getTime());
        const recentScores = scoredChrono.slice(-10).map((x) => Math.round(Number(x.score)));

        return {
          examTypeId: agg.examTypeId,
          examSlug: agg.examSlug,
          examType: {
            id: agg.examTypeId,
            slug: agg.examSlug,
            name: agg.examName,
          },
          testsCount: n,
          averageScore: n > 0 ? Math.round(avg * 100) / 100 : null,
          bestScore: n > 0 ? Math.round(Math.max(...agg.scores) * 100) / 100 : null,
          bestRawScore: agg.bestByPoints?.raw ?? null,
          bestMaxScore: agg.bestByPoints?.max ?? null,
          worstScore: n > 0 ? Math.round(Math.min(...agg.scores) * 100) / 100 : null,
          averageCorrectPercent:
            agg.correctPct.length > 0
              ? Math.round(
                  (agg.correctPct.reduce((a, b) => a + b, 0) / agg.correctPct.length) * 100,
                ) / 100
              : null,
          averageDurationSecs:
            agg.durations.length > 0
              ? Math.round(agg.durations.reduce((a, b) => a + b, 0) / agg.durations.length)
              : null,
          lastFinishedAt:
            agg.finishedAts.length > 0
              ? new Date(Math.max(...agg.finishedAts.map((d) => d.getTime()))).toISOString()
              : null,
          firstFinishedAt:
            agg.finishedAts.length > 0
              ? new Date(Math.min(...agg.finishedAts.map((d) => d.getTime()))).toISOString()
              : null,
          inProgressCount: inProgressByExam.get(agg.examTypeId) ?? 0,
          recentScores,
        };
      })
      .filter((row) => row.testsCount > 0 || row.inProgressCount > 0)
      .sort(
        (a, b) =>
          b.testsCount + b.inProgressCount - (a.testsCount + a.inProgressCount),
      );

    return {
      totalTests,
      completedTests: totalTests,
      inProgressSessionsCount: analyticsInProgressSessions.length,
      averageScore: Math.round(averageScore * 100) / 100,
      byExamType,
    };
  }
}
