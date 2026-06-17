export type AdmissionCycleDto = {
  id: string;
  slug: string;
  sortOrder: number;
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
  isPass: boolean;
  total: number;
  gapToCutoff: number | null;
};
