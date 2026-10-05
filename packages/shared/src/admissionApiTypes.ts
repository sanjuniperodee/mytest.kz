import type { AdmissionChanceLevel } from './admissionCompare';

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
  /** profileSubjects in the request language (profileSubjects itself stays the Russian filter key). */
  profileSubjectsLabel?: string;
  profileVariant?: number;
  displayedQuotaType: 'GRANT' | 'RURAL';
  cutoffSource: 'GRANT' | 'RURAL' | 'GRANT_FALLBACK';
  displayedMinScore: number | null;
  universityCount: number;
  /** Grants awarded for this program across all listed universities. */
  totalGrantCount?: number | null;
  /** Universities where the score reaches the cutoff, and the hardest cutoff among them. */
  passingUniversityCount?: number;
  maxDisplayedMinScore?: number | null;
  /** Best chance across universities. */
  chance?: AdmissionChanceLevel;
  isPass: boolean;
  /** Per-subject ЕНТ thresholds and the 50-point minimum are met. */
  passesEntThresholds?: boolean;
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
  /** profileSubjects in the request language (profileSubjects itself stays the Russian filter key). */
  profileSubjectsLabel?: string;
  profileVariant?: number;
  displayedQuotaType: 'GRANT' | 'RURAL';
  cutoffSource: 'GRANT' | 'RURAL' | 'GRANT_FALLBACK';
  displayedMinScore: number | null;
  maxScore?: number | null;
  avgScore?: number | null;
  /** Grants awarded at this university in the displayed competition. */
  grantCount?: number | null;
  chance?: AdmissionChanceLevel;
  /** Same cutoff in the previous admission year (for the trend). */
  previousMinScore?: number | null;
  previousAdmissionYear?: number | null;
  isPass: boolean;
  /** Per-subject ЕНТ thresholds and the 50-point minimum are met. */
  passesEntThresholds?: boolean;
  total: number;
  gapToCutoff: number | null;
};

/** One admission year of a university × program target. */
export type AdmissionHistoryPointDto = {
  cycleSlug: string;
  admissionYear: number | null;
  displayedQuotaType: 'GRANT' | 'RURAL';
  minScore: number;
  maxScore: number | null;
  avgScore: number | null;
  grantCount: number | null;
};
