"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import {
  ArrowLeft,
  Globe2,
  MessageCircle,
  Plus,
  Send,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LoadState,
  Page,
  Person,
  PersonAvatar,
  personName,
  profileHref,
  SocialNav,
  useSocialText,
} from "./common";

import type { Room } from "./chat-types";
import { Conversation } from "./conversation";
import { CreateGroup } from "./groups";
export function ChatPage() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("room");
  const { user } = useAuth();
  const t = useSocialText();
  const [search, setSearch] = useState("");
  const { data, error, isLoading, mutate } = useSWR<Room[]>(
    "/social/rooms",
    (path: string) => api<Room[]>(path),
    { refreshInterval: 10000 },
  );
  // SWR mutate has stable identity; avoid a read-marker/revalidation feedback loop.
  const onRead = mutate;
  const selectedGlobal = data?.some((room) => room.id === selected && room.kind === "global");
  useEffect(() => {
    if (selectedGlobal) router.replace("/dashboard/global-chat");
  }, [selectedGlobal, router]);
  return (
    <div className="mx-auto max-w-5xl" data-no-translate>
      <SocialNav />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("Сообщения", "Хабарламалар")}
        </h1>
        <CreateGroup onCreated={() => void mutate()} />
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href="/dashboard/community/people">
            <Plus className="size-4" />
            {t("Новый чат", "Жаңа чат")}
          </Link>
        </Button>
      </div>
      <div className="flex h-[calc(100dvh-16rem)] min-h-[390px] overflow-hidden rounded-3xl border border-border bg-background md:h-[min(720px,calc(100dvh-13rem))]">
        <aside
          className={cn(
            "w-full shrink-0 flex-col border-r border-border md:flex md:w-64",
            selected ? "hidden" : "flex",
          )}
        >
          <div className="space-y-3 border-b border-border p-4">
            <Button
              asChild
              variant="outline"
              className="w-full justify-start rounded-xl"
            >
              <Link href="/dashboard/global-chat">
              <Globe2 className="size-4 text-emerald-600" />
              {t("Глобальный чат", "Жаһандық чат")}
              </Link>
            </Button>
            <label className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Найти чат", "Чатты табу")}
                aria-label={t("Поиск чатов", "Чаттарды іздеу")}
                className="w-full min-w-0 bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LoadState
              loading={isLoading}
              error={error}
              retry={() => void mutate()}
            />
            {data
              ?.filter((r) => r.kind !== "global")
              ?.filter((r) =>
                (
                  r.title ||
                  (r.key === "global"
                    ? t("Глобальный чат", "Жаһандық чат")
                    : personName(
                        r.members.find((m) => m.userId !== user?.id)?.user || {
                          id: "",
                          firstName: "",
                          lastName: "",
                          avatarUrl: null,
                        },
                      ))
                )
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((r) => {
                const other = r.members.find(
                  (m) => m.userId !== user?.id,
                )?.user;
                return (
                  <Link
                    key={r.id}
                    href={`/dashboard/messages?room=${r.id}`}
                    className={cn(
                      "flex gap-3 border-b border-border px-4 py-4 transition-colors hover:bg-secondary/60",
                      r.id === selected && "bg-secondary",
                    )}
                    aria-current={r.id === selected ? "page" : undefined}
                  >
                    {r.title || r.key === "global" ? (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                        <Globe2 className="size-5 text-emerald-600" />
                      </div>
                    ) : (
                      other && <PersonAvatar person={other} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {r.title ||
                          (r.key === "global"
                            ? t("Глобальный чат", "Жаһандық чат")
                            : other
                              ? personName(other)
                              : t("Переписка", "Хат алмасу"))}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {r.messages[0]?.body ||
                          t("Начните разговор", "Әңгіме бастаңыз")}
                      </p>
                    </div>
                    {r.unread > 0 && (
                      <span
                        aria-label={t("Непрочитанные", "Оқылмаған")}
                        className="self-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white"
                      >
                        {r.unread > 99 ? "99+" : r.unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            {data?.filter((r) => r.kind !== "global").length === 0 && (
              <p className="p-5 text-center text-sm text-muted-foreground">
                {t(
                  "Личные чаты появятся здесь. Найди собеседника или присоединяйся к глобальному чату.",
                  "Жеке чаттар осы жерде болады. Әңгімелесуші тап немесе жаһандық чатқа қосыл.",
                )}
              </p>
            )}
          </div>
        </aside>
        {selected && !selectedGlobal ? (
          <Conversation
            key={selected}
            id={selected}
            room={data?.find((r) => r.id === selected)}
            onRead={onRead}
          />
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center p-6 text-center md:flex">
            <div className="mb-5 rounded-3xl bg-emerald-500/10 p-5">
              <MessageCircle className="size-9 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold">
              {t(
                "Один разговор — много возможностей",
                "Бір әңгіме — көп мүмкіндік",
              )}
            </h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              {t(
                "Выбери чат слева или найди нового собеседника.",
                "Сол жақтан чат таңда немесе жаңа әңгімелесуші тап.",
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
