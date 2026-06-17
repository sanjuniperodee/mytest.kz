import { GrantQuotaType } from '@prisma/client';

export type ChanceCutoffRow = {
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
};

export function resolveDisplayedCutoff(
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
      displayedQuotaType: resolvedCutoff.displayedQuotaType,
      displayedMinScore: resolvedCutoff.displayedMinScore,
    });
  }

  return resolved;
}
