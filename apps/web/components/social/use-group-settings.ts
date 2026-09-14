"use client";
import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import type { GroupDetail } from './group-types';
export function useGroupSettings(id: string, open: boolean, onChange: () => void) {
  const [busy, setBusy] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<GroupDetail>(
    open ? `/social/rooms/${id}` : null,
    (path: string) => api<GroupDetail>(path),
  );
  async function action(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) {
    setBusy(true);
    try {
      await api(path, { method, body });
      await mutate();
      onChange();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setBusy(false);
    }
  }

return { data, error, isLoading, busy, mutate, action };
}
