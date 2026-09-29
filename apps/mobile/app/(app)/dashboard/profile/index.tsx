import { ProfileView } from "@/components/profile/ProfileView"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/lib/api/auth-context"

/** The current user's profile — the same page everyone else sees, plus the editor. */
export default function MyProfileScreen() {
  const { user } = useAuth()
  if (!user) return <Spinner fullScreen size="large" />
  return <ProfileView key={user.id} id={user.id} />
}
