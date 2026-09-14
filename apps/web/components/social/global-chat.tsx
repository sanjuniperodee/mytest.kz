"use client";

import useSWR from "swr";
import { useEffect } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth-context";
import { Conversation } from "./conversation";
import { LoadState, SocialNav, useSocialText } from "./common";
import type { Room } from "./chat-types";

export function GlobalChatPage() {
  const { user } = useAuth();
  const t = useSocialText();
  // The endpoint idempotently joins the existing global room; it never creates
  // a separate conversation per visit. Keep this request scoped to the user.
  const { data: joined, error: joinError, mutate: retryJoin } = useSWR(
    user ? ["global-chat-membership", user.id] : null,
    () => api<{ id: string }>("/social/rooms/global", { method: "POST" }),
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
  );
  const { data: rooms, error, mutate } = useSWR<Room[]>(
    joined ? "/social/rooms" : null,
    (path: string) => api<Room[]>(path),
    { refreshInterval: 10000 },
  );
  const room = rooms?.find((item) => item.id === joined?.id);
  useEffect(() => {
    if (joined?.id) void mutate();
  }, [joined?.id, mutate]);
  return (
    <div className="mx-auto max-w-5xl" data-no-translate>
      <SocialNav />
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{t("Глобальный чат", "Жаһандық чат")}</h1>
      <div className="flex h-[calc(100dvh-22rem)] min-h-[390px] overflow-hidden rounded-xl border border-border bg-background lg:h-[min(720px,calc(100dvh-13rem))]">
        {room ? (
          <Conversation key={room.id} id={room.id} room={room} onRead={mutate} standalone />
        ) : (
          <div className="w-full p-6">
            <LoadState loading={!joinError && !error && !rooms} error={joinError || error} retry={() => void (joinError ? retryJoin() : mutate())} />
            {rooms && !room && <p>{t("Глобальный чат недоступен", "Жаһандық чат қолжетімсіз")}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
