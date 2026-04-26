import { useQuery } from '@tanstack/react-query';
import { analyticsApi, type TestTaker } from '../../api/analytics';

export function useTestTakers(params?: {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  examTypeId?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'test-takers', params],
    queryFn: async () => {
      const { data } = await analyticsApi.getTestTakers(params);
      return data.data as { items: TestTaker[]; total: number; page: number; limit: number };
    },
  });
}
