import useSWR from "swr"
import { api } from "@/lib/api/client"

export const UNREAD_KEY = "/social/rooms/unread"

/** Unread direct/group messages, shown in the main navigation. */
export function useUnreadMessages(enabled = true) {
  const { data } = useSWR<{ count: number }>(
    enabled ? UNREAD_KEY : null,
    (path: string) => api<{ count: number }>(path),
    { refreshInterval: 30000, revalidateOnFocus: true, shouldRetryOnError: false },
  )
  return data?.count ?? 0
}
