import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GrantQuotaType, Prisma } from '@prisma/client';
import { compareEntToCutoff, type EntScores } from '@bilimland/shared';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdmissionService {
  constructor(private readonly prisma: PrismaService) {}

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
    const cycle = await this.prisma.grantAdmissionCycle.findUnique({
      where: { slug: input.cycleSlug },
    });
    if (!cycle) throw new NotFoundException(`Admission cycle "${input.cycleSlug}" not found`);

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
    const cycle = await this.prisma.grantAdmissionCycle.findUnique({
      where: { slug: input.cycleSlug },
    });
    if (!cycle) throw new NotFoundException(`Admission cycle "${input.cycleSlug}" not found`);

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
}
