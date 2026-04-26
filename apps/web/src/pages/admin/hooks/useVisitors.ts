import { useQuery } from '@tanstack/react-query';
import { analyticsApi, type Visitor } from '../../../api/analytics';

export function useVisitors(params?: {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  search?: string;
  examTypeId?: string;
  step?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'visitors', params],
    queryFn: async () => {
      const { data } = await analyticsApi.getVisitors(params);
      return data.data as { items: Visitor[]; total: number; page: number; limit: number };
    },
  });
}
