import { Inject, Injectable } from '@nestjs/common';
import { EntitlementStatus, EntitlementTier } from '@prisma/client';
import type Redis from 'ioredis';
import { PrismaService } from '../../../database/prisma.service';
import { REDIS_CLIENT } from '../../../database/redis.module';
import type { ParentReportSession } from '../domain/parent-report';

const LINK_KEY = (userId: string) => `parent-report:link:${userId}`;
const CACHE_KEY = (userId: string, version: number, lang: string) =>
  `parent-report:cache:${userId}:${version}:${lang}`;
/** Защитный предел: полного ЕНТ у одного ученика столько не бывает. */
const MAX_SESSIONS = 1000;

type EntSessionRow = {
  id: string;
  examTypeId: string;
  status: string;
  finishedAt: Date | null;
  rawScore: number | null;
  maxScore: number | null;
  score: unknown;
  totalQuestions: number;
  metadata: unknown;
};

@Injectable()
export class ParentReportRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // --- ссылка: текущая версия хранится в Redis; нет ключа — ссылки нет (отозвана) ---

  async getLinkVersion(userId: string): Promise<number | null> {
    const raw = await this.redis.get(LINK_KEY(userId));
    if (raw == null) return null;
    const version = Number(raw);
    return Number.isInteger(version) && version > 0 ? version : null;
  }

  /** Атомарно: создаёт версию, только если её ещё нет. */
  async createLinkVersionIfAbsent(userId: string, version: number, ttlSecs: number): Promise<void> {
    await this.redis.set(LINK_KEY(userId), String(version), 'EX', ttlSecs, 'NX');
  }

  async touchLink(userId: string, ttlSecs: number): Promise<void> {
    await this.redis.expire(LINK_KEY(userId), ttlSecs);
  }

  async deleteLink(userId: string): Promise<void> {
    await this.redis.del(LINK_KEY(userId));
  }

  async getCachedReport(userId: string, version: number, lang: string): Promise<string | null> {
    return this.redis.get(CACHE_KEY(userId, version, lang));
  }

  async cacheReport(
    userId: string,
    version: number,
    lang: string,
    json: string,
    ttlSecs: number,
  ): Promise<void> {
    await this.redis.set(CACHE_KEY(userId, version, lang), json, 'EX', ttlSecs);
  }

  // --- данные отчёта (только чтение) ---

  findStudent(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });
  }

  /**
   * Все завершённые сессии ЕНТ ученика. Из metadata берём только entScope и kind
   * (порядок вопросов и прочее не нужны), поэтому строка лёгкая даже у активных учеников.
   */
  async entSessions(userId: string): Promise<ParentReportSession[]> {
    const rows = await this.prisma.$queryRaw<EntSessionRow[]>`
      SELECT
        ts.id,
        ts.exam_type_id AS "examTypeId",
        ts.status,
        ts.finished_at AS "finishedAt",
        ts.raw_score AS "rawScore",
        ts.max_score AS "maxScore",
        ts.score,
        ts.total_questions AS "totalQuestions",
        jsonb_strip_nulls(
          jsonb_build_object('entScope', ts.metadata -> 'entScope', 'kind', ts.metadata -> 'kind')
        ) AS metadata
      FROM test_sessions ts
      INNER JOIN exam_types et ON et.id = ts.exam_type_id
      WHERE ts.user_id = ${userId}::uuid
        AND et.slug = 'ent'
        AND ts.status IN ('completed', 'timed_out')
        AND ts.finished_at IS NOT NULL
      ORDER BY ts.finished_at DESC, ts.id DESC
      LIMIT ${MAX_SESSIONS}
    `;
    return rows.map((row) => ({
      id: row.id,
      examTypeId: row.examTypeId,
      examType: { id: row.examTypeId, slug: 'ent', name: null },
      status: row.status,
      finishedAt: row.finishedAt,
      rawScore: row.rawScore,
      maxScore: row.maxScore,
      score: row.score,
      totalQuestions: row.totalQuestions,
      durationSecs: null,
      language: '',
      metadata: row.metadata,
    }));
  }

  /** Завершённые тесты любого формата и экзамена с даты `since`. */
  countFinishedSince(userId: string, since: Date): Promise<number> {
    return this.prisma.testSession.count({
      where: {
        userId,
        status: { in: ['completed', 'timed_out'] },
        finishedAt: { gte: since },
      },
    });
  }

  /** Активный платный доступ и до какого числа (подписка или платное право на попытки). */
  async activePlan(userId: string, now: Date): Promise<{ active: boolean; until: string | null }> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        planType: { not: 'free' },
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });
    if (subscription) return { active: true, until: subscription.expiresAt.toISOString() };

    const entitlement = await this.prisma.userExamEntitlement.findFirst({
      where: {
        userId,
        status: EntitlementStatus.active,
        tier: { in: [EntitlementTier.paid, EntitlementTier.admin] },
        windowStartsAt: { lte: now },
        OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
      },
      orderBy: { windowEndsAt: 'desc' },
      select: { windowEndsAt: true },
    });
    if (entitlement) {
      return { active: true, until: entitlement.windowEndsAt?.toISOString() ?? null };
    }
    return { active: false, until: null };
  }
}
