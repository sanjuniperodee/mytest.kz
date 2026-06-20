import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GrantQuotaType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdmissionService } from './admission.service';

export interface ResolvedAdmissionGoal {
  cycleSlug: string;
  quotaType: GrantQuotaType;
  universityCode: number;
  universityName: string;
  universityShortName: string | null;
  programId: string;
  programCode: string;
  programName: string;
  profileSubjects: string | null;
  /** Grant cutoff for this target (null if not published for the cycle). */
  requiredScore: number | null;
  maxScore: number; // ЕНТ total
}

const ENT_TOTAL_MAX = 140;

@Injectable()
export class AdmissionGoalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admission: AdmissionService,
  ) {}

  async getGoal(userId: string): Promise<{ goal: ResolvedAdmissionGoal | null }> {
    const row = await this.prisma.userAdmissionGoal.findUnique({ where: { userId } });
    if (!row) return { goal: null };
    const resolved = await this.resolve(
      row.cycleSlug,
      row.universityCode,
      row.programId,
      row.quotaType,
    );
    return { goal: resolved };
  }

  async setGoal(
    userId: string,
    input: {
      universityCode: number;
      programId: string;
      cycleSlug?: string;
      quotaType?: GrantQuotaType;
    },
  ): Promise<{ goal: ResolvedAdmissionGoal | null }> {
    const quotaType = input.quotaType ?? GrantQuotaType.GRANT;
    const cycleSlug = input.cycleSlug?.trim() || (await this.latestCycleSlug());
    if (!cycleSlug) throw new BadRequestException('NO_ADMISSION_CYCLE');

    // Validate the target exists for this cycle.
    const resolved = await this.resolve(
      cycleSlug,
      input.universityCode,
      input.programId,
      quotaType,
    );
    if (!resolved) throw new NotFoundException('ADMISSION_TARGET_NOT_FOUND');

    await this.prisma.userAdmissionGoal.upsert({
      where: { userId },
      create: {
        userId,
        cycleSlug,
        universityCode: input.universityCode,
        programId: input.programId,
        quotaType,
      },
      update: {
        cycleSlug,
        universityCode: input.universityCode,
        programId: input.programId,
        quotaType,
      },
    });

    return { goal: resolved };
  }

  async clearGoal(userId: string): Promise<{ ok: true }> {
    await this.prisma.userAdmissionGoal
      .delete({ where: { userId } })
      .catch(() => undefined);
    return { ok: true };
  }

  private async latestCycleSlug(): Promise<string | null> {
    const cycles = await this.admission.listCycles();
    if (!Array.isArray(cycles) || cycles.length === 0) return null;
    const sorted = [...cycles].sort(
      (a, b) =>
        (b.sortOrder ?? 0) - (a.sortOrder ?? 0) || String(b.slug).localeCompare(String(a.slug)),
    );
    return sorted[0]?.slug ?? null;
  }

  /** Resolve a target to names + required grant score from the current cutoffs. */
  private async resolve(
    cycleSlug: string,
    universityCode: number,
    programId: string,
    quotaType: GrantQuotaType,
  ): Promise<ResolvedAdmissionGoal | null> {
    let rows: Awaited<ReturnType<AdmissionService['listCutoffs']>> = [];
    try {
      rows = await this.admission.listCutoffs({
        cycleSlug,
        universityCode,
        programId,
        quotaType,
      });
    } catch {
      return null; // unknown cycle, etc.
    }
    const row = rows.find(
      (r) => r.universityCode === universityCode && r.programId === programId,
    );
    if (!row) return null;
    return {
      cycleSlug,
      quotaType,
      universityCode: row.universityCode,
      universityName: row.universityName,
      universityShortName: row.universityShortName ?? null,
      programId: row.programId,
      programCode: row.programCode,
      programName: row.programName,
      profileSubjects: row.profileSubjects ?? null,
      requiredScore: row.minScore ?? null,
      maxScore: ENT_TOTAL_MAX,
    };
  }
}
