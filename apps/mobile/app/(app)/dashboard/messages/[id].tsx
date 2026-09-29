import { router, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect } from "react"
import { View } from "react-native"
import useSWR, { useSWRConfig } from "swr"
import { CommunityGate } from "@/components/community/CommunityGate"
import { Conversation } from "@/components/community/Conversation"
import { LoadState } from "@/components/ui/load-state"
import type { Room } from "@/lib/social/types"
import { UNREAD_KEY } from "@/lib/social/use-unread"

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { mutate: mutateGlobal } = useSWRConfig()
  const { data, error, isLoading, mutate } = useSWR<Room>(`/social/rooms/${id}`, { refreshInterval: 10000 })
  useEffect(() => {
    if (data?.kind === "global") router.replace("/dashboard/global-chat" as never)
  }, [data?.kind])
  const onRead = useCallback(() => {
    void mutate().catch(() => {})
    void mutateGlobal("/social/rooms")
    void mutateGlobal(UNREAD_KEY)
  }, [mutate, mutateGlobal])

  return (
    <CommunityGate>
      {data && data.kind !== "global" ? (
        <Conversation key={id} id={id} room={data} onRead={onRead} />
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          <LoadState loading={isLoading} error={error} retry={() => void mutate().catch(() => {})} />
        </View>
      )}
    </CommunityGate>
  )
}
