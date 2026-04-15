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
