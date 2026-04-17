import { api } from './client';

export type AdmissionCycle = { id: string; slug: string; sortOrder: number };
export type AdmissionUniversity = { code: number; name: string; shortName: string | null };
export type AdmissionProgram = {
  id: string;
  code: string;
  profileVariant: number;
  name: string;
  profileSubjects: string;
  profileShortLabel: string | null;
};

export type AdmissionCutoffRow = {
  cycleSlug: string;
  universityCode: number;
  universityName: string;
  universityShortName: string | null;
  programId: string;
  programCode: string;
  programName: string;
  profileVariant: number;
  profileSubjects: string;
  quotaType: 'GRANT' | 'RURAL';
  minScore: number | null;
};

export type AdmissionCompareResponse = {
  total: number;
  passesEntThresholds: boolean;
  cutoff: number | null;
  hasCutoff: boolean;
  gapToCutoff: number | null;
};

export type AdmissionChanceProfileSubject = {
  value: string;
  label: string;
};

export type AdmissionChanceProgram = {
  cycleSlug: string;
  programId: string;
  programCode: string;
  programName: string;
  profileSubjects: string;
  profileVariant: number;
  displayedQuotaType: 'GRANT' | 'RURAL';
  displayedMinScore: number;
  universityCount: number;
  isPass: boolean;
  total: number;
  gapToCutoff: number;
};

export type AdmissionChanceUniversity = {
  cycleSlug: string;
  universityCode: number;
  universityName: string;
  universityShortName: string | null;
  programId: string;
  programCode: string;
  programName: string;
  profileSubjects: string;
  profileVariant: number;
  displayedQuotaType: 'GRANT' | 'RURAL';
  displayedMinScore: number;
  isPass: boolean;
  total: number;
  gapToCutoff: number;
};

export async function fetchAdmissionCycles(): Promise<AdmissionCycle[]> {
  const { data } = await api.get<AdmissionCycle[]>('/admission/cycles');
  return data;
}

export async function fetchAdmissionUniversities(): Promise<AdmissionUniversity[]> {
  const { data } = await api.get<AdmissionUniversity[]>('/admission/universities');
  return data;
}

export async function fetchAdmissionPrograms(params?: { code?: string; q?: string; take?: number }) {
  const { data } = await api.get<AdmissionProgram[]>('/admission/programs', { params });
  return data;
}

export async function fetchAdmissionCutoffs(params: {
  cycleSlug: string;
  universityCode: number;
  programId?: string;
  quotaType?: 'GRANT' | 'RURAL';
}) {
  const { data } = await api.get<AdmissionCutoffRow[]>('/admission/cutoffs', { params });
  return data;
}

export async function fetchAdmissionCompare(params: {
  cycleSlug: string;
  universityCode: number;
  programId: string;
  quotaType: 'GRANT' | 'RURAL';
  mathLit: number;
  readingLit: number;
  history: number;
  profile1: number;
  profile2: number;
}): Promise<AdmissionCompareResponse> {
  const { data } = await api.get<AdmissionCompareResponse>('/admission/compare', { params });
  return data;
}

export async function fetchAdmissionChanceProfileSubjects(params: {
  cycleSlug: string;
  quotaType: 'GRANT' | 'RURAL';
  universityCode?: number;
}) {
  const { data } = await api.get<AdmissionChanceProfileSubject[]>('/admission/chance/profile-subjects', { params });
  return data;
}

export async function fetchAdmissionChancePrograms(params: {
  cycleSlug: string;
  quotaType: 'GRANT' | 'RURAL';
  profileSubjects: string;
  universityCode?: number;
  programId?: string;
  mathLit: number;
  readingLit: number;
  history: number;
  profile1: number;
  profile2: number;
}) {
  const { data } = await api.get<AdmissionChanceProgram[]>('/admission/chance/programs', { params });
  return data;
}

export async function fetchAdmissionChanceUniversities(params: {
  cycleSlug: string;
  quotaType: 'GRANT' | 'RURAL';
  programId: string;
  universityCode?: number;
  mathLit: number;
  readingLit: number;
  history: number;
  profile1: number;
  profile2: number;
}) {
  const { data } = await api.get<AdmissionChanceUniversity[]>('/admission/chance/universities', { params });
  return data;
}
