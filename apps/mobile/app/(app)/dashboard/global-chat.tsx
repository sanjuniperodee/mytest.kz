import { useCallback } from "react"
import { View } from "react-native"
import useSWR, { useSWRConfig } from "swr"
import { CommunityGate } from "@/components/community/CommunityGate"
import { Conversation } from "@/components/community/Conversation"
import { LoadState } from "@/components/ui/load-state"
import { useAuth } from "@/lib/api/auth-context"
import { api } from "@/lib/api/client"
import type { Room } from "@/lib/social/types"
import { UNREAD_KEY } from "@/lib/social/use-unread"

export default function GlobalChatScreen() {
  const { user } = useAuth()
  const { mutate: mutateGlobal } = useSWRConfig()
  // The endpoint idempotently joins the one global room; it never creates a conversation per visit.
  const { data: joined, error: joinError, mutate: retryJoin } = useSWR(
    user ? ["global-chat-membership", user.id] : null,
    () => api<{ id: string }>("/social/rooms/global", { method: "POST" }),
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
  )
  const { data: room, error, mutate } = useSWR<Room>(joined ? `/social/rooms/${joined.id}` : null, { refreshInterval: 10000 })
  const onRead = useCallback(() => {
    void mutate().catch(() => {})
    void mutateGlobal(UNREAD_KEY)
  }, [mutate, mutateGlobal])

  return (
    <CommunityGate>
      {room ? (
        <Conversation key={room.id} id={room.id} room={room} onRead={onRead} standalone />
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          <LoadState loading={!joinError && !error} error={joinError || error} retry={() => void (joinError ? retryJoin() : mutate()).catch(() => {})} />
        </View>
      )}
    </CommunityGate>
  )
}
