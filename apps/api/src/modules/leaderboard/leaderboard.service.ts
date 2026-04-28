import { Injectable } from '@nestjs/common';
import { ENT_CONFIG } from '@bilimland/shared';
import { PrismaService } from '../../database/prisma.service';

export interface EntLeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  telegramUsername: string | null;
  rawScore: number;
  maxScore: number;
  score: number;
  durationSecs: number | null;
  finishedAt: string | null;
  sessionId: string;
  profileSubjects: string[]; // e.g. ['Математика', 'Физика']
}

export interface EntLeaderboardResponse {
  items: EntLeaderboardRow[];
  me: EntLeaderboardRow | null;
}

type EligibleSession = {
  id: string;
  userId: string;
  rawScore: unknown;
  maxScore: unknown;
  score: unknown;
  durationSecs: number | null;
  finishedAt: Date | null;
  metadata: unknown;
  user: {
    firstName: string | null;
    lastName: string | null;
    telegramUsername: string | null;
  };
};

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getEntLeaderboard(userId: string, limit = 50): Promise<EntLeaderboardResponse> {
    const take = Math.min(Math.max(Math.floor(limit) || 50, 1), 100);
    const sessions = await this.prisma.testSession.findMany({
      where: {
        status: { in: ['completed', 'timed_out'] },
        totalQuestions: ENT_CONFIG.totalQuestions,
        rawScore: { not: null },
        maxScore: ENT_CONFIG.maxTotalPoints,
        examType: { slug: 'ent' },
      },
      select: {
        id: true,
        userId: true,
        rawScore: true,
        maxScore: true,
        score: true,
        durationSecs: true,
        finishedAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            telegramUsername: true,
          },
        },
        metadata: true,
      },
    });

    const bestByUser = new Map<string, EligibleSession>();
    for (const session of sessions as EligibleSession[]) {
      const previous = bestByUser.get(session.userId);
      if (!previous || this.compareSessions(session, previous) < 0) {
        bestByUser.set(session.userId, session);
      }
    }

    const sorted = Array.from(bestByUser.values())
      .sort((a, b) => this.compareSessions(a, b));

    const rows = await Promise.all(
      sorted.map((session, index) => this.toRow(session, index + 1)),
    );

    return {
      items: rows.slice(0, take),
      me: rows.find((row) => row.userId === userId) ?? null,
    };
  }

  private compareSessions(a: EligibleSession, b: EligibleSession): number {
    const rawDelta = this.toNumber(b.rawScore) - this.toNumber(a.rawScore);
    if (rawDelta !== 0) return rawDelta;

    const aDuration = a.durationSecs ?? Number.MAX_SAFE_INTEGER;
    const bDuration = b.durationSecs ?? Number.MAX_SAFE_INTEGER;
    if (aDuration !== bDuration) return aDuration - bDuration;

    const aFinished = a.finishedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bFinished = b.finishedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aFinished !== bFinished) return aFinished - bFinished;

    return a.userId.localeCompare(b.userId);
  }

  private async toRow(session: EligibleSession, rank: number): Promise<EntLeaderboardRow> {
    const maxScore = this.toNumber(session.maxScore);
    const rawScore = this.toNumber(session.rawScore);
    const scorePct = this.toNumber(session.score);

    // Extract profile subject IDs from metadata
    const meta = session.metadata as Record<string, unknown> | null;
    const profileSubjectIds: string[] = Array.isArray(meta?.profileSubjectIds) ? (meta.profileSubjectIds as string[]) : [];

    // Fetch subject names if any
    let profileSubjects: string[] = [];
    if (profileSubjectIds.length > 0) {
      const subjects = await this.prisma.subject.findMany({
        where: { id: { in: profileSubjectIds } },
        select: { id: true, name: true },
      });
      // preserve order from profileSubjectIds
      const nameById = new Map(subjects.map((s) => [s.id, s.name]));
      profileSubjects = profileSubjectIds.map((id) => String(nameById.get(id) ?? id));
    }

    return {
      rank,
      userId: session.userId,
      displayName: this.getDisplayName(session.user),
      telegramUsername: session.user.telegramUsername,
      rawScore,
      maxScore,
      score: scorePct,
      durationSecs: session.durationSecs,
      finishedAt: session.finishedAt?.toISOString() ?? null,
      sessionId: session.id,
      profileSubjects,
    };
  }

  private toNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private getDisplayName(user: EligibleSession['user']): string {
    const fullName = [user.firstName, user.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
    if (fullName) return fullName;
    if (user.telegramUsername) return `@${user.telegramUsername}`;
    return 'Ученик MyTest';
  }
}
