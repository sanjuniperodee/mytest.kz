"use client";

import useSWR from "swr";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth-context";
import { Conversation } from "./conversation";
import { PageHeader } from "@/components/dashboard/page-header";
import { LoadState, useSocialText } from "./common";
import type { Room } from "./chat-types";

export function GlobalChatPage() {
  const { user } = useAuth();
  const t = useSocialText();
  // The endpoint idempotently joins the existing global room; it never creates
  // a separate conversation per visit. Keep this request scoped to the user.
  const {
    data: joined,
    error: joinError,
    mutate: retryJoin,
  } = useSWR(
    user ? ["global-chat-membership", user.id] : null,
    () => api<{ id: string }>("/social/rooms/global", { method: "POST" }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );
  const {
    data: room,
    error,
    mutate,
  } = useSWR<Room>(
    joined ? `/social/rooms/${joined.id}` : null,
    (path: string) => api<Room>(path),
    { refreshInterval: 10000 },
  );
  return (
    <div
      className="flex h-[calc(100dvh-10rem)] min-h-[400px] min-w-0 flex-col lg:h-[min(900px,calc(100dvh-4rem))]"
      data-no-translate
    >
      <PageHeader
        className="mb-6 shrink-0"
        title={t("Глобальный чат", "Жаһандық чат")}
        description={t(
          "Вопросы по подготовке, полезные находки и общение со всеми участниками.",
          "Дайындық сұрақтары, пайдалы материалдар және барлық қатысушылармен әңгіме.",
        )}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border/80 bg-background shadow-xs">
        {room ? (
          <Conversation
            key={room.id}
            id={room.id}
            room={room}
            onRead={mutate}
            standalone
          />
        ) : (
          <div className="w-full p-6">
            <LoadState
              loading={!joinError && !error && !room}
              error={joinError || error}
              retry={() =>
                void (joinError ? retryJoin() : mutate()).catch(() => {})
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
