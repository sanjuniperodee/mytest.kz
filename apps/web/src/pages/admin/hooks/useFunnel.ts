import { useQuery } from '@tanstack/react-query';
import { analyticsApi, type FunnelData } from '../../api/analytics';

export function useFunnel(params?: { from?: string; to?: string; examTypeId?: string }) {
  return useQuery({
    queryKey: ['admin', 'funnel', params],
    queryFn: async () => {
      const { data } = await analyticsApi.getFunnel(params);
      return data.data as FunnelData;
    },
  });
}
