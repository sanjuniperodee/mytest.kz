import { useLocalSearchParams } from "expo-router"
import { CommunityGate } from "@/components/community/CommunityGate"
import { ProfileView } from "@/components/profile/ProfileView"
import { useAuth } from "@/lib/api/auth-context"

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const view = <ProfileView key={id} id={id} />
  // Other people's content is community content: rules first.
  return id === user?.id ? view : <CommunityGate>{view}</CommunityGate>
}
