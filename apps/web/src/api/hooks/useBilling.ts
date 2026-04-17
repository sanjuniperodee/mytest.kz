import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { BillingPlan, CheckoutResponse } from '../types';

export function useBillingPlans() {
  return useQuery<BillingPlan[]>({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const { data } = await api.get<BillingPlan[]>('/billing/plans');
      return data;
    },
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async (planId: string) => {
      const { data } = await api.post<CheckoutResponse>('/billing/checkout', { planId });
      return data;
    },
  });
}
