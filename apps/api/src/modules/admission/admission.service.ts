import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GrantQuotaType, Prisma } from '@prisma/client';
import { compareEntToCutoff, type EntScores } from '@bilimland/shared';
import { resolveChanceRows, resolveDisplayedCutoff } from './domain/chance-cutoffs';
import type { ResolvedChanceRow } from './domain/chance-cutoffs';
import { AdmissionRepository } from './infrastructure/admission.repository';
import { REDIS_CLIENT } from '../../database/redis.module';
import Redis from 'ioredis';

function isPassing(comparison: ReturnType<typeof compareEntToCutoff>): boolean {
  return comparison.passesEntThresholds && comparison.gapToCutoff != null && comparison.gapToCutoff >= 0;
}

@Injectable()
export class AdmissionService {
  constructor(
    private readonly admissionRepository: AdmissionRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async getCycleOrThrow(cycleSlug: string) {
    const cycle = await this.admissionRepository.findCycleBySlug(cycleSlug);
    if (!cycle) throw new NotFoundException(`Admission cycle "${cycleSlug}" not found`);
    return cycle;
  }

  private admissionCacheVersionKey(cycleSlug: string) {
    return `admission-cache-version:${cycleSlug}`;
  }

  private async listResolvedChanceRows(input: {
    cycleSlug: string;
    quotaType: GrantQuotaType;
    universityCode?: number;
    profileSubjects?: string;
    programId?: string;
  }): Promise<ResolvedChanceRow[]> {
    const version = (await this.redis.get(this.admissionCacheVersionKey(input.cycleSlug))) || '0';
    // "rows2": resolved rows carry grant statistics and the rural = min(rural, general) rule
    const cacheKey = `admission-chance-rows2:v${version}:${input.cycleSlug}:${input.quotaType}:${input.universityCode || 'all'}:${input.profileSubjects || 'all'}:${input.programId || 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ResolvedChanceRow[];
    }

    const cycle = await this.getCycleOrThrow(input.cycleSlug);
    const rows = await this.admissionRepository.listChanceCutoffs({
      cycleId: cycle.id,
      quotaType: input.quotaType,
      universityCode: input.universityCode,
      profileSubjects: input.profileSubjects,
      programId: input.programId,
    });

    const resolved = resolveChanceRows(input.quotaType, rows);
    await this.redis.set(cacheKey, JSON.stringify(resolved), 'EX', 600); // 10 minutes cache TTL
    return resolved;
  }

  listCycles() {
    return this.admissionRepository.listCycles();
  }

  async listUniversities(input: { cycleSlug?: string } = {}) {
    const cycleId = input.cycleSlug ? (await this.getCycleOrThrow(input.cycleSlug)).id : undefined;
    return this.admissionRepository.listUniversities(cycleId);
  }

  async listPrograms(input: { code?: string; q?: string; take?: number }) {
    const take = Math.min(500, Math.max(1, input.take ?? 120));
    const where: Prisma.EntEducationalProgramWhereInput = {};
    if (input.code?.trim()) {
      where.code = input.code.trim().toUpperCase();
    }
    if (input.q?.trim()) {
      where.OR = [
        { name: { contains: input.q.trim(), mode: 'insensitive' } },
        { profileSubjects: { contains: input.q.trim(), mode: 'insensitive' } },
      ];
    }
    return this.admissionRepository.listPrograms({
      where,
      take,
    });
  }

  async listCutoffs(input: {
    cycleSlug: string;
    universityCode?: number;
    programId?: string;
    quotaType?: GrantQuotaType;
  }) {
    const cycle = await this.getCycleOrThrow(input.cycleSlug);

    if (input.universityCode == null && !input.programId) {
      throw new BadRequestException('Provide universityCode and/or programId');
    }

    const where: Prisma.GrantCutoffWhereInput = { cycleId: cycle.id };
    if (input.universityCode != null) where.universityCode = input.universityCode;
    if (input.programId) where.programId = input.programId;
    if (input.quotaType) where.quotaType = input.quotaType;

    const rows = await this.admissionRepository.listCutoffs(where);

    return rows.map((r) => ({
      cycleSlug: input.cycleSlug,
      universityCode: r.universityCode,
      universityName: r.university.name,
      universityShortName: r.university.shortName,
      programId: r.programId,
      programCode: r.program.code,
      programName: r.program.name,
      profileVariant: r.program.profileVariant,
      profileSubjects: r.program.profileSubjects,
      quotaType: r.quotaType,
      minScore: r.minScore,
      maxScore: r.maxScore ?? null,
      avgScore: r.avgScore ?? null,
      grantCount: r.grantCount ?? null,
    }));
  }

  async compare(input: {
    cycleSlug: string;
    universityCode: number;
    programId: string;
    quotaType: GrantQuotaType;
    scores: EntScores;
  }) {
    const cycle = await this.getCycleOrThrow(input.cycleSlug);

    // Same resolution as the chance endpoints: a rural applicant is compared with the lower of the
    // rural-quota and general-competition cutoffs.
    const cutoffs = await this.admissionRepository.findCutoffs({
      cycleId: cycle.id,
      universityCode: input.universityCode,
      programId: input.programId,
    });
    const displayed = resolveDisplayedCutoff(input.quotaType, cutoffs);
    return {
      ...compareEntToCutoff(input.scores, displayed?.displayedMinScore ?? null),
      displayedQuotaType: displayed?.displayedQuotaType ?? null,
      grantCount: displayed?.grantCount ?? null,
    };
  }

  async listChanceProfileSubjects(input: {
    cycleSlug: string;
    quotaType: GrantQuotaType;
    universityCode?: number;
  }) {
    const rows = await this.listResolvedChanceRows({
      cycleSlug: input.cycleSlug,
      quotaType: input.quotaType,
      universityCode: input.universityCode,
    });
    const uniq = new Set(rows.map((r) => r.profileSubjects));
    return [...uniq]
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((value) => ({ value, label: value }));
  }

  async listChancePrograms(input: {
    cycleSlug: string;
    quotaType: GrantQuotaType;
    profileSubjects: string;
    universityCode?: number;
    programId?: string;
    scores: EntScores;
  }) {
    const rows = await this.listResolvedChanceRows({
      cycleSlug: input.cycleSlug,
      quotaType: input.quotaType,
      profileSubjects: input.profileSubjects,
      universityCode: input.universityCode,
      programId: input.programId,
    });

    const grouped = new Map<string, ResolvedChanceRow[]>();
    for (const row of rows) {
      const list = grouped.get(row.programId);
      if (list) {
        list.push(row);
      } else {
        grouped.set(row.programId, [row]);
      }
    }

    const result = [...grouped.values()].map((groupRows) => {
      const minRow = groupRows.reduce((acc, cur) =>
        cur.displayedMinScore < acc.displayedMinScore ? cur : acc,
      );
      const comparison = compareEntToCutoff(input.scores, minRow.displayedMinScore);
      const totalGrantCount = groupRows.some((r) => r.grantCount != null)
        ? groupRows.reduce((sum, r) => sum + (r.grantCount ?? 0), 0)
        : null;
      return {
        cycleSlug: input.cycleSlug,
        programId: minRow.programId,
        programCode: minRow.programCode,
        programName: minRow.programName,
        profileSubjects: minRow.profileSubjects,
        profileVariant: minRow.profileVariant,
        displayedQuotaType: minRow.displayedQuotaType,
        cutoffSource:
          minRow.displayedQuotaType === input.quotaType
            ? input.quotaType
            : 'GRANT_FALLBACK',
        displayedMinScore: minRow.displayedMinScore,
        universityCount: groupRows.length,
        /** Grants awarded across all universities of this program (in the displayed competitions). */
        totalGrantCount,
        isPass: isPassing(comparison),
        total: comparison.total,
        passesEntThresholds: comparison.passesEntThresholds,
        gapToCutoff: comparison.gapToCutoff,
      };
    });

    return result.sort((a, b) => {
      if (a.isPass !== b.isPass) return a.isPass ? -1 : 1;
      if (a.displayedMinScore !== b.displayedMinScore) return a.displayedMinScore - b.displayedMinScore;
      return a.programCode.localeCompare(b.programCode, 'en');
    });
  }

  async listChanceUniversities(input: {
    cycleSlug: string;
    quotaType: GrantQuotaType;
    programId: string;
    universityCode?: number;
    scores: EntScores;
  }) {
    const rows = await this.listResolvedChanceRows({
      cycleSlug: input.cycleSlug,
      quotaType: input.quotaType,
      programId: input.programId,
      universityCode: input.universityCode,
    });
    return rows
      .map((row) => {
        const comparison = compareEntToCutoff(input.scores, row.displayedMinScore);
        return {
          cycleSlug: input.cycleSlug,
          universityCode: row.universityCode,
          universityName: row.universityName,
          universityShortName: row.universityShortName,
          programId: row.programId,
          programCode: row.programCode,
          programName: row.programName,
          profileSubjects: row.profileSubjects,
          profileVariant: row.profileVariant,
          displayedQuotaType: row.displayedQuotaType,
          cutoffSource:
            row.displayedQuotaType === input.quotaType
              ? input.quotaType
              : 'GRANT_FALLBACK',
          displayedMinScore: row.displayedMinScore,
          maxScore: row.maxScore,
          avgScore: row.avgScore,
          grantCount: row.grantCount,
          isPass: isPassing(comparison),
          total: comparison.total,
          passesEntThresholds: comparison.passesEntThresholds,
          gapToCutoff: comparison.gapToCutoff,
        };
      })
      .sort((a, b) => {
        if (a.isPass !== b.isPass) return a.isPass ? -1 : 1;
        if (a.displayedMinScore !== b.displayedMinScore) return a.displayedMinScore - b.displayedMinScore;
        return a.universityCode - b.universityCode;
      });
  }
}
