import { Injectable } from '@nestjs/common';
import { GrantQuotaType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AdmissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCycleBySlug(slug: string) {
    return this.prisma.grantAdmissionCycle.findUnique({
      where: { slug },
    });
  }

  listCycles() {
    return this.prisma.grantAdmissionCycle.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, slug: true, sortOrder: true, admissionYear: true },
    });
  }

  /** Universities with at least one published cutoff (optionally within one cycle). */
  listUniversities(cycleId?: string) {
    return this.prisma.university.findMany({
      where: {
        cutoffs: { some: { minScore: { not: null }, ...(cycleId ? { cycleId } : {}) } },
      },
      orderBy: { code: 'asc' },
      select: { code: true, name: true, nameKk: true, shortName: true },
    });
  }

  listPrograms(params: {
    where: Prisma.EntEducationalProgramWhereInput;
    take: number;
  }) {
    return this.prisma.entEducationalProgram.findMany({
      where: params.where,
      orderBy: [{ code: 'asc' }, { profileVariant: 'asc' }],
      take: params.take,
      select: {
        id: true,
        code: true,
        profileVariant: true,
        name: true,
        nameKk: true,
        profileSubjects: true,
        profileSubjectsKk: true,
        profileShortLabel: true,
      },
    });
  }

  listCutoffs(where: Prisma.GrantCutoffWhereInput) {
    return this.prisma.grantCutoff.findMany({
      where,
      take: 8000,
      include: {
        university: { select: { name: true, nameKk: true, shortName: true } },
        program: {
          select: {
            code: true,
            name: true,
            nameKk: true,
            profileSubjects: true,
            profileSubjectsKk: true,
            profileVariant: true,
          },
        },
      },
      orderBy: [{ universityCode: 'asc' }, { programId: 'asc' }, { quotaType: 'asc' }],
    });
  }

  /** Everything the public SEO dataset is built from (one read of the whole reference). */
  async loadSeoDatasetSource() {
    const [cycles, universities, programs, cutoffs] = await Promise.all([
      this.prisma.grantAdmissionCycle.findMany({
        select: { id: true, slug: true, admissionYear: true, createdAt: true },
      }),
      this.prisma.university.findMany({
        select: { code: true, name: true, nameKk: true, shortName: true },
      }),
      this.prisma.entEducationalProgram.findMany({
        select: {
          id: true,
          code: true,
          profileVariant: true,
          name: true,
          nameKk: true,
          profileSubjects: true,
          profileSubjectsKk: true,
        },
      }),
      this.prisma.grantCutoff.findMany({
        where: { minScore: { not: null } },
        select: {
          cycleId: true,
          universityCode: true,
          programId: true,
          quotaType: true,
          minScore: true,
          maxScore: true,
          avgScore: true,
          grantCount: true,
        },
      }),
    ]);
    return { cycles, universities, programs, cutoffs };
  }

  findCutoffs(where: Prisma.GrantCutoffWhereInput) {
    return this.prisma.grantCutoff.findMany({ where });
  }

  listChanceCutoffs(input: {
    cycleId: string;
    quotaType: GrantQuotaType;
    universityCode?: number;
    profileSubjects?: string;
    programId?: string;
  }) {
    return this.prisma.grantCutoff.findMany({
      where: this.buildChanceCutoffWhere(input),
      include: {
        university: { select: { name: true, nameKk: true, shortName: true } },
        program: {
          select: {
            code: true,
            name: true,
            nameKk: true,
            profileSubjects: true,
            profileSubjectsKk: true,
            profileVariant: true,
          },
        },
      },
      orderBy: [{ universityCode: 'asc' }, { programId: 'asc' }, { quotaType: 'asc' }],
    });
  }

  private buildChanceCutoffWhere(input: {
    cycleId: string;
    quotaType: GrantQuotaType;
    universityCode?: number;
    profileSubjects?: string;
    programId?: string;
  }): Prisma.GrantCutoffWhereInput {
    return {
      cycleId: input.cycleId,
      minScore: { not: null },
      quotaType:
        input.quotaType === 'GRANT'
          ? 'GRANT'
          : {
              in: ['GRANT', 'RURAL'],
            },
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
  }
}
