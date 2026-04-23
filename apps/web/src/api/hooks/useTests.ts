import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { TestSession, PaginatedResponse, MistakesSummary } from '../types';

export function useStartTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      templateId: string;
      language: string;
      profileSubjectIds?: string[];
      /** только ЕНТ: mandatory | profile | full */
      entScope?: 'mandatory' | 'profile' | 'full';
    }) => {
      const { data } = await api.post<TestSession>('/tests/start', params);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
    },
  });
}

export function useTestSession(sessionId: string | undefined) {
  return useQuery<TestSession>({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const { data } = await api.get(`/tests/sessions/${sessionId}`);
      return data;
    },
    enabled: !!sessionId,
    refetchInterval: (query) => {
      // Refetch every 30s while in progress to sync timer
      return query.state.data?.status === 'in_progress' ? 30_000 : false;
    },
  });
}

export function useSessions(page = 1) {
  return useQuery<PaginatedResponse<TestSession>>({
    queryKey: ['sessions', page],
    queryFn: async () => {
      const { data } = await api.get('/tests/sessions', {
        params: { page, limit: 10 },
      });
      return data;
    },
  });
}

export function useSubmitAnswer(sessionId: string) {
  return useMutation({
    mutationFn: async (params: { questionId: string; selectedIds: string[] }) => {
      const { data } = await api.post(`/tests/sessions/${sessionId}/answer`, params);
      return data;
    },
  });
}

export function useFinishTest(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/tests/sessions/${sessionId}/finish`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['mistakes-summary'] });
    },
  });
}

export function useMistakesSummary() {
  return useQuery<MistakesSummary>({
    queryKey: ['mistakes-summary'],
    queryFn: async () => {
      const { data } = await api.get<MistakesSummary>('/tests/mistakes/summary');
      return data;
    },
  });
}

export function useStartMistakesPractice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      language: string;
      examTypeId?: string;
      limit?: number;
      durationMins?: number;
    }) => {
      const { data } = await api.post<TestSession>('/tests/mistakes/practice', params);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['mistakes-summary'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
    },
  });
}

export function useTestReview(sessionId: string | undefined) {
  return useQuery<TestSession>({
    queryKey: ['review', sessionId],
    queryFn: async () => {
      const { data } = await api.get(`/tests/sessions/${sessionId}/review`);
      return data;
    },
    enabled: !!sessionId,
  });
}

export function useExplanation(sessionId: string, questionId: string, enabled: boolean) {
  return useQuery<{ questionId: string; explanation: unknown; imageUrls?: string[] }>({
    queryKey: ['explanation', sessionId, questionId],
    queryFn: async () => {
      const { data } = await api.get(
        `/tests/sessions/${sessionId}/review/${questionId}/explanation`,
      );
      return data;
    },
    enabled,
    /** Объяснение для вопроса не меняется в рамках сессии; кэш убирает мигание при повторном открытии. */
    staleTime: 30 * 60_000,
  });
}
