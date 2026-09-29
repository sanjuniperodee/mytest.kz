import { CommunityGate } from "@/components/community/CommunityGate"
import { Inbox } from "@/components/community/Inbox"

export default function MessagesScreen() {
  return (
    <CommunityGate>
      <Inbox />
    </CommunityGate>
  )
}
