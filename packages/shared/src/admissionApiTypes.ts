export type AdmissionCycleDto = {
  id: string;
  /** Academic year the grants are for, e.g. "2026-2027". */
  slug: string;
  sortOrder: number;
  /** Year of the ЕНТ / grant competition, e.g. 2026 (null for legacy rows). */
  admissionYear?: number | null;
};

export type UniversityDto = {
  code: number;
  name: string;
  shortName: string | null;
};

export type EntProgramDto = {
  id: string;
  code: string;
  profileVariant: number;
  name: string;
  profileSubjects: string;
  profileShortLabel: string | null;
};

export type GrantCutoffDto = {
  cycleSlug: string;
  universityCode: number;
  programId: string;
  quotaType: 'GRANT' | 'RURAL';
  minScore: number | null;
  maxScore?: number | null;
  avgScore?: number | null;
  /** Grants awarded in this competition (official MNVO list). */
  grantCount?: number | null;
};

export type ChanceProgramDto = {
  cycleSlug: string;
  programId: string;
  programCode: string;
  programName: string;
  profileSubjects: string;
  profileVariant?: number;
  displayedQuotaType: 'GRANT' | 'RURAL';
  cutoffSource: 'GRANT' | 'RURAL' | 'GRANT_FALLBACK';
  displayedMinScore: number | null;
  universityCount: number;
  /** Grants awarded for this program across all listed universities. */
  totalGrantCount?: number | null;
  isPass: boolean;
  total: number;
  gapToCutoff: number | null;
};

export type ChanceUniversityDto = {
  cycleSlug: string;
  universityCode: number;
  universityName: string;
  universityShortName: string | null;
  programId: string;
  programCode: string;
  programName: string;
  profileSubjects: string;
  profileVariant?: number;
  displayedQuotaType: 'GRANT' | 'RURAL';
  cutoffSource: 'GRANT' | 'RURAL' | 'GRANT_FALLBACK';
  displayedMinScore: number | null;
  maxScore?: number | null;
  avgScore?: number | null;
  /** Grants awarded at this university in the displayed competition. */
  grantCount?: number | null;
  isPass: boolean;
  total: number;
  gapToCutoff: number | null;
};
