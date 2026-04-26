import axios from 'axios';
import { resolveApiBaseUrl } from '../../lib/resolveApiBaseUrl';

const API_BASE = resolveApiBaseUrl({
  viteApiUrl: import.meta.env.VITE_API_URL,
  viteSiteUrl:
    import.meta.env.VITE_SITE_URL ||
    (import.meta.env.PROD ? 'https://my-test.kz' : undefined),
  viteProd: import.meta.env.PROD,
});

export interface FunnelData {
  period: { from: string; to: string };
  totals: {
    visits: number;
    registered: number;
    started: number;
    completed: number;
  };
  conversionRates: {
    visitToRegistered: number;
    registeredToStarted: number;
    startedToCompleted: number;
    visitToCompleted: number;
  };
  byDate: Array<{
    date: string;
    visits: number;
    registered: number;
    started: number;
    completed: number;
  }>;
  byExamType: Array<{
    examTypeId: string;
    examName: unknown;
    started: number;
    completed: number;
    avgScore: number | null;
  }>;
}

export interface Visitor {
  visitorId: string;
  userId: string | null;
  user: {
    id: string;
    telegramId: number;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  firstSeen: string;
  lastSeen: string;
  steps: string[];
  completedSessions: Array<{
    sessionId: string;
    examType: unknown;
    score: number | null;
    finishedAt: string | null;
    durationSecs: number | null;
  }>;
}

export interface TestTaker {
  userId: string;
  telegramId: number;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  testsCompleted: number;
  lastTestAt: string | null;
  bestScore: number | null;
  avgScore: number | null;
  avgDurationSecs: number | null;
}

const noAuthClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export const analyticsApi = {
  recordVisit: (params: {
    visitorId?: string;
    source?: string;
    medium?: string;
    campaign?: string;
    referrer?: string;
    landingPath?: string;
  }) =>
    noAuthClient.post('/analytics/visit', params),

  getFunnel: (params?: { from?: string; to?: string; examTypeId?: string }) =>
    axios.get(`${API_BASE}/admin/analytics/funnel`, { params }),

  getVisitors: (params?: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    search?: string;
    examTypeId?: string;
    step?: string;
  }) => axios.get(`${API_BASE}/admin/analytics/visitors`, { params }),

  getTestTakers: (params?: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    examTypeId?: string;
  }) => axios.get(`${API_BASE}/admin/analytics/test-takers`, { params }),
};
