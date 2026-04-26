import { api } from './client';

export type FunnelData = {
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
};

export type Visitor = {
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
};

export type TestTaker = {
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
};

export type PlatformOverview = {
  totalUsers: number;
  totalTests: number;
  totalQuestions: number;
  activeSubscriptions: number;
};

export function fetchFunnel(params?: { from?: string; to?: string; examTypeId?: string }) {
  return api.get<FunnelData>('/admin/analytics/funnel', { params }).then((r) => r.data);
}

export function fetchVisitors(params?: {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  search?: string;
  examTypeId?: string;
  step?: string;
}) {
  return api
    .get<{ items: Visitor[]; total: number; page: number; limit: number }>('/admin/analytics/visitors', {
      params,
    })
    .then((r) => r.data);
}

export function fetchTestTakers(params?: {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  examTypeId?: string;
}) {
  return api
    .get<{ items: TestTaker[]; total: number; page: number; limit: number }>('/admin/analytics/test-takers', {
      params,
    })
    .then((r) => r.data);
}

export function fetchPlatformOverview() {
  return api.get<PlatformOverview>('/admin/analytics/overview').then((r) => r.data);
}
