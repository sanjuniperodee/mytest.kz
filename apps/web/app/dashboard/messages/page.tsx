import { Suspense } from "react";
import { ChatPage } from "@/components/social/chat";
import { Skeleton } from "@/components/ui/skeleton";
export default function MessagesPage() {
  return (
    <Suspense
      fallback={<Skeleton className="h-80 rounded-xl" />}
    >
      <ChatPage />
    </Suspense>
  );
}
