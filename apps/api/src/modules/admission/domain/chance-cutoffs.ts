import { GrantQuotaType } from '@prisma/client';

export type CutoffStats = {
  minScore: number | null;
  maxScore?: number | null;
  avgScore?: number | null;
  grantCount?: number | null;
};

export type ChanceCutoffRow = CutoffStats & {
  universityCode: number;
  quotaType: GrantQuotaType;
  university: { name: string; shortName: string | null };
  program: {
    code: string;
    name: string;
    profileSubjects: string;
    profileVariant: number;
  };
  programId: string;
};

export type ResolvedChanceRow = {
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
      universityName: base.university.name,
      universityShortName: base.university.shortName,
      programId: base.programId,
      programCode: base.program.code,
      programName: base.program.name,
      profileSubjects: base.program.profileSubjects,
      profileVariant: base.program.profileVariant,
      ...resolvedCutoff,
    });
  }

  return resolved;
}
