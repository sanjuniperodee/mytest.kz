import { Suspense } from "react";
import { ChatPage } from "@/components/social/chat";
export default function MessagesPage() {
  return (
    <Suspense
      fallback={<div className="h-80 animate-pulse rounded-xl bg-secondary" />}
    >
      <ChatPage />
    </Suspense>
  );
}
