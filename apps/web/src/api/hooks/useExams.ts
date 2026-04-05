import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { ExamType, Subject, TestTemplate } from '../types';

export function useExamTypes() {
  return useQuery<ExamType[]>({
    queryKey: ['examTypes'],
    queryFn: async () => {
      const { data } = await api.get('/exams/types');
      return data;
    },
  });
}

export function useSubjects(examTypeId: string | undefined) {
  return useQuery<Subject[]>({
    queryKey: ['subjects', examTypeId],
    queryFn: async () => {
      const { data } = await api.get(`/exams/types/${examTypeId}/subjects`);
      return data;
    },
    enabled: !!examTypeId,
  });
}

export function useTemplates(examTypeId: string | undefined) {
  return useQuery<TestTemplate[]>({
    queryKey: ['templates', examTypeId],
    queryFn: async () => {
      const { data } = await api.get(`/exams/types/${examTypeId}/templates`);
      return data;
    },
    enabled: !!examTypeId,
  });
}
