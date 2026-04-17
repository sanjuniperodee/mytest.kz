import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GrantQuotaType, Prisma } from '@prisma/client';
import { compareEntToCutoff, type EntScores } from '@bilimland/shared';
import { PrismaService } from '../../database/prisma.service';

type ChanceRawCutoffRow = {
  universityCode: number;
  quotaType: GrantQuotaType;
  minScore: number | null;
  university: { name: string; shortName: string | null };
  program: {
    code: string;
    name: string;
    profileSubjects: string;
    profileVariant: number;
  };
  programId: string;
};

type ResolvedChanceRow = {
  universityCode: number;
  universityName: string;
  universityShortName: string | null;
  programId: string;
  programCode: string;
  programName: string;
  profileSubjects: string;
  profileVariant: number;
  displayedQuotaType: GrantQuotaType;
  displayedMinScore: number;
};

@Injectable()
export class AdmissionService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCycleOrThrow(cycleSlug: string) {
    const cycle = await this.prisma.grantAdmissionCycle.findUnique({
      where: { slug: cycleSlug },
    });
    if (!cycle) throw new NotFoundException(`Admission cycle "${cycleSlug}" not found`);
    return cycle;
  }

  /**
   * Resolver для отображаемого проходного балла:
   * - GRANT: учитываем только GRANT
   * - RURAL: сначала RURAL, если нет балла -> fallback на GRANT
   */
  private resolveDisplayedCutoff(
    quotaType: GrantQuotaType,
    rows: { quotaType: GrantQuotaType; minScore: number | null }[],
  ): { displayedQuotaType: GrantQuotaType; displayedMinScore: number } | null {
    const grant = rows.find((r) => r.quotaType === 'GRANT');
    const rural = rows.find((r) => r.quotaType === 'RURAL');

    if (quotaType === 'GRANT') {
      if (grant?.minScore == null) return null;
      return { displayedQuotaType: 'GRANT', displayedMinScore: grant.minScore };
    }

    if (rural?.minScore != null) {
      return { displayedQuotaType: 'RURAL', displayedMinScore: rural.minScore };
    }
    if (grant?.minScore != null) {
      return { displayedQuotaType: 'GRANT', displayedMinScore: grant.minScore };
    }
    return null;
  }

  private async listResolvedChanceRows(input: {
    cycleSlug: string;
    quotaType: GrantQuotaType;
    universityCode?: number;
    profileSubjects?: string;
    programId?: string;
  }) {
    const cycle = await this.getCycleOrThrow(input.cycleSlug);
    const where: Prisma.GrantCutoffWhereInput = {
      cycleId: cycle.id,
      ...(input.universityCode != null ? { universityCode: input.universityCode } : {}),
      ...(input.programId ? { programId: input.programId } : {}),
      ...(input.profileSubjects
        ? {
            program: {
              profileSubjects: input.profileSubjects,
            },
          }
        : {}),
    };

    const rows = await this.prisma.grantCutoff.findMany({
      where,
      include: {
        university: { select: { name: true, shortName: true } },
        program: {
          select: { code: true, name: true, profileSubjects: true, profileVariant: true },
        },
      },
      orderBy: [{ universityCode: 'asc' }, { programId: 'asc' }, { quotaType: 'asc' }],
      take: 15000,
    });

    const grouped = new Map<string, ChanceRawCutoffRow[]>();
    for (const row of rows) {
      const key = `${row.universityCode}:${row.programId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(row);
      } else {
        grouped.set(key, [row]);
      }
    }

    const resolved: ResolvedChanceRow[] = [];
    for (const groupRows of grouped.values()) {
      const resolvedCutoff = this.resolveDisplayedCutoff(input.quotaType, groupRows);
      if (!resolvedCutoff) continue;
      const base = groupRows[0];
      resolved.push({
        universityCode: base.universityCode,
        universityName: base.university.name,
        universityShortName: base.university.shortName,
        programId: base.programId,
        programCode: base.program.code,
        programName: base.program.name,
        profileSubjects: base.program.profileSubjects,
        profileVariant: base.program.profileVariant,
        displayedQuotaType: resolvedCutoff.displayedQuotaType,
        displayedMinScore: resolvedCutoff.displayedMinScore,
      });
    }

    return resolved;
  }

  listCycles() {
    return this.prisma.grantAdmissionCycle.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, slug: true, sortOrder: true },
    });
  }

  listUniversities() {
    return this.prisma.university.findMany({
      orderBy: { code: 'asc' },
      select: { code: true, name: true, shortName: true },
    });
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
    return this.prisma.entEducationalProgram.findMany({
      where,
      orderBy: [{ code: 'asc' }, { profileVariant: 'asc' }],
      take,
      select: {
        id: true,
        code: true,
        profileVariant: true,
        name: true,
        profileSubjects: true,
        profileShortLabel: true,
      },
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

    const rows = await this.prisma.grantCutoff.findMany({
      where,
      take: 8000,
      include: {
        university: { select: { name: true, shortName: true } },
        program: {
          select: { code: true, name: true, profileSubjects: true, profileVariant: true },
        },
      },
      orderBy: [{ universityCode: 'asc' }, { programId: 'asc' }, { quotaType: 'asc' }],
    });

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

    const cutoff = await this.prisma.grantCutoff.findFirst({
      where: {
        cycleId: cycle.id,
        universityCode: input.universityCode,
        programId: input.programId,
        quotaType: input.quotaType,
      },
    });

    const minScore = cutoff?.minScore ?? null;
    return compareEntToCutoff(input.scores, minScore);
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

    const total = compareEntToCutoff(input.scores, null).total;
    const result = [...grouped.values()].map((groupRows) => {
      const minRow = groupRows.reduce((acc, cur) =>
        cur.displayedMinScore < acc.displayedMinScore ? cur : acc,
      );
      return {
        cycleSlug: input.cycleSlug,
        programId: minRow.programId,
        programCode: minRow.programCode,
        programName: minRow.programName,
        profileSubjects: minRow.profileSubjects,
        profileVariant: minRow.profileVariant,
        displayedQuotaType: minRow.displayedQuotaType,
        displayedMinScore: minRow.displayedMinScore,
        universityCount: groupRows.length,
        isPass: total >= minRow.displayedMinScore,
        total,
        gapToCutoff: total - minRow.displayedMinScore,
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
    const total = compareEntToCutoff(input.scores, null).total;

    return rows
      .map((row) => ({
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
        displayedMinScore: row.displayedMinScore,
        isPass: total >= row.displayedMinScore,
        total,
        gapToCutoff: total - row.displayedMinScore,
      }))
      .sort((a, b) => {
        if (a.isPass !== b.isPass) return a.isPass ? -1 : 1;
        if (a.displayedMinScore !== b.displayedMinScore) return a.displayedMinScore - b.displayedMinScore;
        return a.universityCode - b.universityCode;
      });
  }
}
