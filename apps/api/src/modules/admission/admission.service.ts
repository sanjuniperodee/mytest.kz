import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GrantQuotaType, Prisma } from '@prisma/client';
import {
  admissionChance,
  compareEntToCutoff,
  type AdmissionChanceLevel,
  type AdmissionHistoryPointDto,
  type EntScores,
} from '@bilimland/shared';
import { localizedName, resolveChanceRows, resolveDisplayedCutoff } from './domain/chance-cutoffs';
import type { ResolvedChanceRow } from './domain/chance-cutoffs';
import { AdmissionRepository } from './infrastructure/admission.repository';
import { REDIS_CLIENT } from '../../database/redis.module';
import Redis from 'ioredis';

function isPassing(comparison: ReturnType<typeof compareEntToCutoff>): boolean {
  return comparison.passesEntThresholds && comparison.gapToCutoff != null && comparison.gapToCutoff >= 0;
}

const CHANCE_RANK: Record<AdmissionChanceLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };

function chanceFor(comparison: ReturnType<typeof compareEntToCutoff>, row: ResolvedChanceRow) {
  return admissionChance(comparison.total, comparison.passesEntThresholds, row.displayedMinScore, row.avgScore);
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
    // "rows3": names are { ru, kk } (resolved per request by the I18nInterceptor)
    const cacheKey = `admission-chance-rows3:v${version}:${input.cycleSlug}:${input.quotaType}:${input.universityCode || 'all'}:${input.profileSubjects || 'all'}:${input.programId || 'all'}`;
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
    const rows = await this.admissionRepository.listUniversities(cycleId);
    return rows.map(({ nameKk, ...u }) => ({ ...u, name: localizedName(u.name, nameKk) }));
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
    const rows = await this.admissionRepository.listPrograms({ where, take });
    return rows.map(({ nameKk, profileSubjectsKk, ...p }) => ({
      ...p,
      name: localizedName(p.name, nameKk),
      profileSubjectsLabel: localizedName(p.profileSubjects, profileSubjectsKk),
    }));
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
      universityName: localizedName(r.university.name, r.university.nameKk),
      universityShortName: r.university.shortName,
      programId: r.programId,
      programCode: r.program.code,
      programName: localizedName(r.program.name, r.program.nameKk),
      profileVariant: r.program.profileVariant,
      profileSubjects: r.program.profileSubjects,
      profileSubjectsLabel: localizedName(r.program.profileSubjects, r.program.profileSubjectsKk),
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
    const labels = new Map<string, ResolvedChanceRow['profileSubjectsLabel']>();
    for (const r of rows) if (!labels.has(r.profileSubjects)) labels.set(r.profileSubjects, r.profileSubjectsLabel);
    return [...labels.keys()]
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((value) => ({ value, label: labels.get(value) ?? value }));
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
      let passingUniversityCount = 0;
      let chance: AdmissionChanceLevel = 'NONE';
      for (const row of groupRows) {
        const c = compareEntToCutoff(input.scores, row.displayedMinScore);
        if (isPassing(c)) passingUniversityCount++;
        const level = chanceFor(c, row);
        if (CHANCE_RANK[level] < CHANCE_RANK[chance]) chance = level;
      }
      const totalGrantCount = groupRows.some((r) => r.grantCount != null)
        ? groupRows.reduce((sum, r) => sum + (r.grantCount ?? 0), 0)
        : null;
      return {
        cycleSlug: input.cycleSlug,
        programId: minRow.programId,
        programCode: minRow.programCode,
        programName: minRow.programName,
        profileSubjects: minRow.profileSubjects,
        profileSubjectsLabel: minRow.profileSubjectsLabel,
        profileVariant: minRow.profileVariant,
        displayedQuotaType: minRow.displayedQuotaType,
        cutoffSource:
          minRow.displayedQuotaType === input.quotaType
            ? input.quotaType
            : 'GRANT_FALLBACK',
        displayedMinScore: minRow.displayedMinScore,
        maxDisplayedMinScore: Math.max(...groupRows.map((r) => r.displayedMinScore)),
        universityCount: groupRows.length,
        passingUniversityCount,
        /** Grants awarded across all universities of this program (in the displayed competitions). */
        totalGrantCount,
        chance,
        isPass: isPassing(comparison),
        total: comparison.total,
        passesEntThresholds: comparison.passesEntThresholds,
        gapToCutoff: comparison.gapToCutoff,
      };
    });

    return result.sort((a, b) => {
      if (a.chance !== b.chance) return CHANCE_RANK[a.chance] - CHANCE_RANK[b.chance];
      if (a.passingUniversityCount !== b.passingUniversityCount) {
        return b.passingUniversityCount - a.passingUniversityCount;
      }
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

    // Previous admission year of the same program, for the trend ("2025: 98 → 2026: 100").
    const previousCycle = await this.findPreviousCycle(input.cycleSlug);
    const previousByUni = new Map<number, number>();
    if (previousCycle) {
      const prevRows = await this.listResolvedChanceRows({
        cycleSlug: previousCycle.slug,
        quotaType: input.quotaType,
        programId: input.programId,
        universityCode: input.universityCode,
      });
      for (const r of prevRows) previousByUni.set(r.universityCode, r.displayedMinScore);
    }

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
          profileSubjectsLabel: row.profileSubjectsLabel,
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
          chance: chanceFor(comparison, row),
          previousMinScore: previousByUni.get(row.universityCode) ?? null,
          previousAdmissionYear: previousCycle?.admissionYear ?? null,
          isPass: isPassing(comparison),
          total: comparison.total,
          passesEntThresholds: comparison.passesEntThresholds,
          gapToCutoff: comparison.gapToCutoff,
        };
      })
      .sort((a, b) => {
        if (a.chance !== b.chance) return CHANCE_RANK[a.chance] - CHANCE_RANK[b.chance];
        // reachable: the most competitive first; out of reach: the closest first
        if (a.displayedMinScore !== b.displayedMinScore) {
          return a.isPass ? b.displayedMinScore - a.displayedMinScore : a.displayedMinScore - b.displayedMinScore;
        }
        return a.universityCode - b.universityCode;
      });
  }

  private async findPreviousCycle(cycleSlug: string) {
    const cycles = await this.admissionRepository.listCycles();
    const current = cycles.find((c) => c.slug === cycleSlug);
    if (!current) return null;
    return (
      cycles
        .filter((c) => c.sortOrder < current.sortOrder)
        .sort((a, b) => b.sortOrder - a.sortOrder)[0] ?? null
    );
  }

  /** Cutoff of one university × program in every admission year (oldest first). */
  async history(input: {
    universityCode: number;
    programId: string;
    quotaType: GrantQuotaType;
  }): Promise<AdmissionHistoryPointDto[]> {
    const [cycles, cutoffs] = await Promise.all([
      this.admissionRepository.listCycles(),
      this.admissionRepository.findCutoffs({
        universityCode: input.universityCode,
        programId: input.programId,
      }),
    ]);
    const points: AdmissionHistoryPointDto[] = [];
    for (const cycle of [...cycles].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const displayed = resolveDisplayedCutoff(
        input.quotaType,
        cutoffs.filter((c) => c.cycleId === cycle.id),
      );
      if (!displayed) continue;
      points.push({
        cycleSlug: cycle.slug,
        admissionYear: cycle.admissionYear ?? null,
        displayedQuotaType: displayed.displayedQuotaType,
        minScore: displayed.displayedMinScore,
        maxScore: displayed.maxScore,
        avgScore: displayed.avgScore,
        grantCount: displayed.grantCount,
      });
    }
    return points;
  }
}
