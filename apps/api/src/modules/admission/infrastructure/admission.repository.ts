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
      select: { id: true, slug: true, sortOrder: true },
    });
  }

  listUniversities() {
    return this.prisma.university.findMany({
      orderBy: { code: 'asc' },
      select: { code: true, name: true, shortName: true },
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
        profileSubjects: true,
        profileShortLabel: true,
      },
    });
  }

  listCutoffs(where: Prisma.GrantCutoffWhereInput) {
    return this.prisma.grantCutoff.findMany({
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
  }

  findCutoff(where: Prisma.GrantCutoffWhereInput) {
    return this.prisma.grantCutoff.findFirst({ where });
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
        university: { select: { name: true, shortName: true } },
        program: {
          select: { code: true, name: true, profileSubjects: true, profileVariant: true },
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
