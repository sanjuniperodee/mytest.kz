import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ENT_CONFIG } from '@bilimland/shared';
import { PrismaService } from '../../database/prisma.service';

export interface EntLeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  telegramUsername: string | null;
  avatarUrl: string | null;
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
    avatarUrl: string | null;
  };
};

type RankedSessionRow = {
  rank: number | bigint;
  id: string;
  userId: string;
  rawScore: number | bigint;
  maxScore: number | bigint;
  score: number | string | null;
  durationSecs: number | null;
  finishedAt: Date | null;
  metadata: unknown;
  firstName: string | null;
  lastName: string | null;
  telegramUsername: string | null;
  avatarUrl: string | null;
};

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getEntLeaderboard(userId: string, limit = 50): Promise<EntLeaderboardResponse> {
    const take = Math.min(Math.max(Math.floor(limit) || 50, 1), 100);
    let rankedSessions: Array<{ rank: number; session: EligibleSession }>;

    if (typeof (this.prisma as { $queryRaw?: unknown }).$queryRaw === 'function') {
      const rankedRows = await this.prisma.$queryRaw<RankedSessionRow[]>(
        Prisma.sql`
          WITH eligible AS (
            SELECT
              ts.id,
              ts.user_id AS "userId",
              ts.raw_score AS "rawScore",
              ts.max_score AS "maxScore",
              ts.score::double precision AS score,
              ts.duration_secs AS "durationSecs",
              ts.finished_at AS "finishedAt",
              ts.metadata,
              u.first_name AS "firstName",
              u.last_name AS "lastName",
              u.telegram_username AS "telegramUsername",
              u.avatar_url AS "avatarUrl",
              ROW_NUMBER() OVER (
                PARTITION BY ts.user_id
                ORDER BY
                  ts.raw_score DESC,
                  ts.duration_secs ASC NULLS LAST,
                  ts.finished_at ASC NULLS LAST,
                  ts.id ASC
              ) AS user_rank
            FROM test_sessions ts
            INNER JOIN exam_types et ON et.id = ts.exam_type_id
            INNER JOIN users u ON u.id = ts.user_id
            WHERE et.slug = 'ent'
              AND ts.status IN ('completed', 'timed_out')
              AND ts.total_questions = ${ENT_CONFIG.totalQuestions}
              AND ts.raw_score IS NOT NULL
              AND ts.max_score = ${ENT_CONFIG.maxTotalPoints}
          ),
          best_per_user AS (
            SELECT *
            FROM eligible
            WHERE user_rank = 1
          ),
          ranked AS (
            SELECT
              *,
              ROW_NUMBER() OVER (
                ORDER BY
                  "rawScore" DESC,
                  "durationSecs" ASC NULLS LAST,
                  "finishedAt" ASC NULLS LAST,
                  "userId" ASC
              ) AS rank
            FROM best_per_user
          )
          SELECT
            rank,
            id,
            "userId",
            "rawScore",
            "maxScore",
            score,
            "durationSecs",
            "finishedAt",
            metadata,
            "firstName",
            "lastName",
            "telegramUsername",
            "avatarUrl"
          FROM ranked
          WHERE rank <= ${take}
             OR "userId" = ${userId}::uuid
          ORDER BY rank ASC
        `,
      );

      rankedSessions = rankedRows.map((row) => ({
        rank: Number(row.rank),
        session: {
          id: row.id,
          userId: row.userId,
          rawScore: row.rawScore,
          maxScore: row.maxScore,
          score: row.score,
          durationSecs: row.durationSecs,
          finishedAt: row.finishedAt,
          metadata: row.metadata,
          user: {
            firstName: row.firstName,
            lastName: row.lastName,
            telegramUsername: row.telegramUsername,
            avatarUrl: row.avatarUrl,
          },
        } satisfies EligibleSession,
      }));
    } else {
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
              avatarUrl: true,
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

      rankedSessions = Array.from(bestByUser.values())
        .sort((a, b) => this.compareSessions(a, b))
        .map((session, index) => ({ rank: index + 1, session }));
    }

    const profileSubjectIds = [
      ...new Set(
        rankedSessions.flatMap(({ session }) =>
          this.extractProfileSubjectIds(session.metadata),
        ),
      ),
    ];
    const subjects = profileSubjectIds.length
      ? await this.prisma.subject.findMany({
          where: { id: { in: profileSubjectIds } },
          select: { id: true, name: true },
        })
      : [];
    const subjectNameById = new Map(
      subjects.map((subject) => [subject.id, this.getSubjectName(subject.name, 'ru')]),
    );

    const rows = rankedSessions.map(({ session, rank }) =>
      this.toRow(session, rank, subjectNameById),
    );

    return {
      items: rows.filter((row) => row.rank <= take),
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

  private getSubjectName(name: unknown, lang = 'ru'): string {
    if (!name || typeof name !== 'object') return String(name ?? '');
    const obj = name as Record<string, unknown>;
    const localized = obj[lang] ?? obj['ru'] ?? obj['kk'] ?? Object.values(obj)[0];
    return String(localized ?? '');
  }

  private extractProfileSubjectIds(metadata: unknown): string[] {
    const meta = metadata as Record<string, unknown> | null;
    return Array.isArray(meta?.profileSubjectIds)
      ? (meta.profileSubjectIds as string[]).filter((value) => typeof value === 'string')
      : [];
  }

  private toRow(
    session: EligibleSession,
    rank: number,
    subjectNameById: Map<string, string>,
  ): EntLeaderboardRow {
    const maxScore = this.toNumber(session.maxScore);
    const rawScore = this.toNumber(session.rawScore);
    const scorePct = this.toNumber(session.score);

    const profileSubjects = this.extractProfileSubjectIds(session.metadata)
      .map((id) => subjectNameById.get(id))
      .filter((value): value is string => Boolean(value));

    return {
      rank,
      userId: session.userId,
      displayName: this.getDisplayName(session.user),
      telegramUsername: session.user.telegramUsername,
      avatarUrl: session.user.avatarUrl ?? null,
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
