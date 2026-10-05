import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GrantQuotaType } from '@prisma/client';
import { ENT_TOTAL_MAX, type AdmissionHistoryPointDto } from '@bilimland/shared';
import { PrismaService } from '../../database/prisma.service';
import { AdmissionService } from './admission.service';
import { resolveDisplayedCutoff, type LocalizedName } from './domain/chance-cutoffs';

export interface ResolvedAdmissionGoal {
  cycleSlug: string;
  quotaType: GrantQuotaType;
  universityCode: number;
  /** { ru, kk } or a plain string — resolved to the request language by the I18nInterceptor. */
  universityName: LocalizedName;
  universityShortName: string | null;
  programId: string;
  programCode: string;
  programName: LocalizedName;
  profileSubjects: string | null;
  profileSubjectsLabel: LocalizedName | null;
  /** Cutoff for this target (null if not published for the cycle). */
  requiredScore: number | null;
  /** Which competition `requiredScore` comes from (a rural applicant gets the lower of the two). */
  requiredScoreQuotaType: GrantQuotaType | null;
  /** Grants awarded in that competition at this university. */
  grantCount: number | null;
  /** Average / best score of last year's grant holders (for the chance estimate). */
  avgScore: number | null;
  topScore: number | null;
  admissionYear: number | null;
  /** The same target in every admission year, oldest first. */
  history: AdmissionHistoryPointDto[];
  maxScore: number; // ЕНТ total
}

@Injectable()
export class AdmissionGoalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admission: AdmissionService,
  ) {}

  async getGoal(userId: string): Promise<{ goal: ResolvedAdmissionGoal | null }> {
    const row = await this.prisma.userAdmissionGoal.findUnique({ where: { userId } });
    if (!row) return { goal: null };
    // Show the freshest cutoff: a goal saved last year should follow the newest admission data.
    const latest = await this.latestCycleSlug();
    let resolved =
      latest && latest !== row.cycleSlug
        ? await this.resolve(latest, row.universityCode, row.programId, row.quotaType)
        : null;
    resolved ??= await this.resolve(row.cycleSlug, row.universityCode, row.programId, row.quotaType);
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
      rows = await this.admission.listCutoffs({ cycleSlug, universityCode, programId });
    } catch {
      return null; // unknown cycle, etc.
    }
    rows = rows.filter((r) => r.universityCode === universityCode && r.programId === programId);
    const row = rows.find((r) => r.quotaType === GrantQuotaType.GRANT) ?? rows[0];
    if (!row) return null;
    const displayed = resolveDisplayedCutoff(quotaType, rows);
    const history = await this.admission.history({ universityCode, programId, quotaType });
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
      profileSubjectsLabel: row.profileSubjectsLabel ?? null,
      requiredScore: displayed?.displayedMinScore ?? null,
      requiredScoreQuotaType: displayed?.displayedQuotaType ?? null,
      grantCount: displayed?.grantCount ?? null,
      avgScore: displayed?.avgScore ?? null,
      topScore: displayed?.maxScore ?? null,
      admissionYear: history.find((h) => h.cycleSlug === cycleSlug)?.admissionYear ?? null,
      history,
      maxScore: ENT_TOTAL_MAX,
    };
  }
}
