import { GrantQuotaType } from '@prisma/client';

/**
 * A name with an optional Kazakh translation. Sent as { ru, kk } so the global I18nInterceptor
 * resolves it to the request language (Accept-Language / profile); a plain string otherwise.
 */
export type LocalizedName = string | { ru: string; kk: string };

export function localizedName(ru: string, kk: string | null | undefined): LocalizedName {
  return kk && kk.trim() && kk !== ru ? { ru, kk } : ru;
}

export type CutoffStats = {
  minScore: number | null;
  maxScore?: number | null;
  avgScore?: number | null;
  grantCount?: number | null;
};

export type ChanceCutoffRow = CutoffStats & {
  universityCode: number;
  quotaType: GrantQuotaType;
  university: { name: string; nameKk?: string | null; shortName: string | null };
  program: {
    code: string;
    name: string;
    nameKk?: string | null;
    profileSubjects: string;
    profileSubjectsKk?: string | null;
    profileVariant: number;
  };
  programId: string;
};

export type ResolvedChanceRow = {
  universityCode: number;
  universityName: LocalizedName;
  universityShortName: string | null;
  programId: string;
  programCode: string;
  programName: LocalizedName;
  /** Russian value — used as the filter key. */
  profileSubjects: string;
  profileSubjectsLabel: LocalizedName;
  profileVariant: number;
  displayedQuotaType: GrantQuotaType;
  displayedMinScore: number;
  /** Grants awarded in the competition the displayed cutoff comes from (null for legacy data). */
  grantCount: number | null;
  maxScore: number | null;
  avgScore: number | null;
};

export type DisplayedCutoff = {
  displayedQuotaType: GrantQuotaType;
  displayedMinScore: number;
  grantCount: number | null;
  maxScore: number | null;
  avgScore: number | null;
};

function toDisplayed(quotaType: GrantQuotaType, row: CutoffStats & { minScore: number }): DisplayedCutoff {
  return {
    displayedQuotaType: quotaType,
    displayedMinScore: row.minScore,
    grantCount: row.grantCount ?? null,
    maxScore: row.maxScore ?? null,
    avgScore: row.avgScore ?? null,
  };
}

/**
 * Which cutoff an applicant of the given quota type has to beat.
 *
 * GRANT: only the general-competition cutoff.
 * RURAL: by the grant rules 65% of a program's grants are awarded in the general competition (open to
 * everyone, rural applicants included) and 35% only among rural youth — so a rural applicant competes in
 * both pools and the effective cutoff is the LOWER of the two. If only one of them exists, that one.
 */
export function resolveDisplayedCutoff(
  quotaType: GrantQuotaType,
  rows: (CutoffStats & { quotaType: GrantQuotaType })[],
): DisplayedCutoff | null {
  const grant = rows.find((r) => r.quotaType === 'GRANT' && r.minScore != null);
  const rural = rows.find((r) => r.quotaType === 'RURAL' && r.minScore != null);

  if (quotaType === 'GRANT') {
    return grant ? toDisplayed('GRANT', grant as CutoffStats & { minScore: number }) : null;
  }

  if (rural && (!grant || rural.minScore! <= grant.minScore!)) {
    return toDisplayed('RURAL', rural as CutoffStats & { minScore: number });
  }
  if (grant) {
    return toDisplayed('GRANT', grant as CutoffStats & { minScore: number });
  }
  return null;
}

export function resolveChanceRows(
  quotaType: GrantQuotaType,
  rows: ChanceCutoffRow[],
): ResolvedChanceRow[] {
  const grouped = new Map<string, ChanceCutoffRow[]>();
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
    const resolvedCutoff = resolveDisplayedCutoff(quotaType, groupRows);
    if (!resolvedCutoff) continue;
    const base = groupRows[0];
    resolved.push({
      universityCode: base.universityCode,
      universityName: localizedName(base.university.name, base.university.nameKk),
      universityShortName: base.university.shortName,
      programId: base.programId,
      programCode: base.program.code,
      programName: localizedName(base.program.name, base.program.nameKk),
      profileSubjects: base.program.profileSubjects,
      profileSubjectsLabel: localizedName(base.program.profileSubjects, base.program.profileSubjectsKk),
      profileVariant: base.program.profileVariant,
      ...resolvedCutoff,
    });
  }

  return resolved;
}
