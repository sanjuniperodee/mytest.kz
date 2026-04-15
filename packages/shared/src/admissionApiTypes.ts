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
