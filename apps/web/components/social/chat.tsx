"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Globe2, MessageCircle, Plus, Search, Users } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LoadState,
  PersonAvatar,
  personName,
  SocialNav,
  useSocialText,
} from "./common";
import type { Room } from "./chat-types";
import { Conversation } from "./conversation";
import { CreateGroup } from "./groups";

export function ChatPage() {
  const selected = useSearchParams().get("room");
  const { user } = useAuth();
  const t = useSocialText();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, error, isLoading, mutate } = useSWR<Room[]>(
    "/social/rooms",
    (path: string) => api<Room[]>(path),
    { refreshInterval: 10000, refreshWhenHidden: false },
  );
  const rooms = (data || []).filter((room) => room.kind !== "global");
  const title = (room: Room) =>
    room.title ||
    personName(
      room.members.find((member) => member.userId !== user?.id)?.user || {
        id: "",
        firstName: null,
        lastName: null,
        avatarUrl: null,
      },
    );
  const visible = rooms.filter(
    (room) =>
      (filter === "all" ||
        (filter === "unread" ? room.unread > 0 : room.kind === filter)) &&
      title(room)
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const unread = rooms.reduce((sum, room) => sum + room.unread, 0);
  const preview = (room: Room) => {
    const message = room.messages[0];
    if (!message) return t("Пока нет сообщений", "Әзірге хабарлама жоқ");
    if (message.body) return message.body;
    const mime = message.attachment?.mime || "";
    return mime.startsWith("audio/")
      ? t("Голосовое сообщение", "Дауыстық хабарлама")
      : mime.startsWith("image/")
        ? t("Фото", "Фото")
        : mime.startsWith("video/")
          ? t("Видео", "Бейне")
          : t("Вложение", "Тіркеме");
  };
  return (
    <div
      className="mx-auto max-w-5xl"
      data-no-translate
      data-testid="messages-page"
    >
      <div className={selected ? "hidden md:block" : "block"}>
        <SocialNav />
      </div>
      <header
        className={cn(
          "mb-5 flex flex-wrap items-start justify-between gap-3",
          selected && "hidden md:flex",
        )}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("Сообщения", "Хабарламалар")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread
              ? t(`Непрочитанных: ${unread}`, `Оқылмаған: ${unread}`)
              : t(
                  "Личные разговоры и учебные группы",
                  "Жеке әңгімелер мен оқу топтары",
                )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateGroup onCreated={() => void mutate()} />
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/community/people">
              <Plus className="size-4" />
              {t("Новый чат", "Жаңа чат")}
            </Link>
          </Button>
        </div>
      </header>
      <div
        className={cn(
          "flex overflow-hidden rounded-xl border border-border bg-card md:h-[min(760px,calc(100dvh-13rem))] md:min-h-[440px]",
          selected ? "h-[calc(100dvh-11rem)] min-h-[360px]" : "min-h-[460px]",
        )}
      >
        <aside
          className={cn(
            "w-full shrink-0 flex-col md:w-80 md:border-r md:border-border",
            selected ? "hidden md:flex" : "flex",
          )}
        >
          <div className="space-y-3 border-b border-border p-4">
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(
                  "Имя или название группы",
                  "Аты немесе топ атауы",
                )}
                aria-label={t("Поиск чатов", "Чаттарды іздеу")}
                className="w-full min-w-0 bg-transparent text-sm outline-none"
              />
            </label>
            <div
              className="flex flex-wrap gap-1"
              aria-label={t("Фильтр чатов", "Чат сүзгісі")}
            >
              {[
                ["all", t("Все", "Барлығы")],
                ["unread", t("Непрочитанные", "Оқылмаған")],
                ["group", t("Группы", "Топтар")],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "min-h-9 rounded-lg px-2.5 text-xs font-medium",
                    filter === id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            data-testid="room-list"
          >
            <LoadState
              loading={isLoading}
              error={error}
              retry={() => void mutate().catch(() => {})}
            />
            {visible.map((room) => {
              const other = room.members.find(
                (member) => member.userId !== user?.id,
              )?.user;
              const last = room.messages[0];
              return (
                <Link
                  key={room.id}
                  href={`/dashboard/messages?room=${room.id}`}
                  aria-current={room.id === selected ? "page" : undefined}
                  className={cn(
                    "flex gap-3 border-b border-border/60 px-4 py-4 hover:bg-muted/60",
                    room.id === selected && "bg-muted",
                  )}
                >
                  {room.kind === "group" ? (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Users className="size-5" />
                    </span>
                  ) : (
                    other && <PersonAvatar person={other} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">
                        {title(room)}
                      </p>
                      {last && (
                        <time
                          className="shrink-0 text-[10px] text-muted-foreground"
                          dateTime={last.createdAt}
                        >
                          {new Date(last.createdAt).toLocaleDateString(
                            t("ru-RU", "kk-KZ"),
                            { day: "numeric", month: "short" },
                          )}
                        </time>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {last?.authorId === user?.id ? `${t("Вы", "Сіз")}: ` : ""}
                      {preview(room)}
                    </p>
                    {room.archived && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("Группа закрыта", "Топ жабық")}
                      </p>
                    )}
                  </div>
                  {room.unread > 0 && (
                    <span
                      aria-label={t("Непрочитанные", "Оқылмаған")}
                      className="self-center rounded-full bg-foreground px-2 py-0.5 text-xs text-background"
                    >
                      {room.unread > 99 ? "99+" : room.unread}
                    </span>
                  )}
                </Link>
              );
            })}
            {!isLoading && !error && visible.length === 0 && (
              <div className="p-6 text-center">
                <MessageCircle className="mx-auto mb-3 size-7 text-muted-foreground" />
                <h2 className="text-sm font-semibold">
                  {search.trim()
                    ? t("Чаты не найдены", "Чаттар табылмады")
                    : filter === "unread"
                      ? t("Всё прочитано", "Бәрі оқылды")
                      : t("Начните разговор", "Әңгіме бастаңыз")}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {search.trim()
                    ? t(
                        "Проверьте имя или очистите поиск.",
                        "Атын тексеріңіз немесе іздеуді тазалаңыз.",
                      )
                    : t(
                        "Найдите человека в сообществе или создайте учебную группу.",
                        "Қауымдастықтан адам табыңыз немесе оқу тобын құрыңыз.",
                      )}
                </p>
                {(search || filter !== "all") && (
                  <Button
                    className="mt-4"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    {t("Сбросить фильтры", "Сүзгілерді тазалау")}
                  </Button>
                )}
              </div>
            )}
          </div>
          <Link
            className="flex min-h-14 items-center gap-2 border-t border-border px-4 text-sm hover:bg-muted"
            href="/dashboard/global-chat"
          >
            <Globe2 className="size-4" />
            {t("Глобальный чат", "Жаһандық чат")}
          </Link>
        </aside>
        {selected ? (
          <SelectedConversation key={selected} id={selected} onRead={mutate} />
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center p-8 text-center md:flex">
            <MessageCircle className="mb-4 size-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              {t("Выберите разговор", "Әңгімені таңдаңыз")}
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t(
                "Текст, файлы и голосовые — в одном месте. Глобальный чат открыт на отдельной странице.",
                "Мәтін, файлдар және дауыстық хабарламалар — бір жерде. Жаһандық чат бөлек бетте.",
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SelectedConversation({
  id,
  onRead,
}: {
  id: string;
  onRead: () => void;
}) {
  const t = useSocialText();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<Room>(
    `/social/rooms/${id}`,
    (path: string) => api<Room>(path),
    { refreshInterval: 10000 },
  );
  useEffect(() => {
    if (data?.kind === "global") router.replace("/dashboard/global-chat");
  }, [data?.kind, router]);
  const refresh = useCallback(() => {
    void mutate().catch(() => {});
    onRead();
  }, [mutate, onRead]);
  if (!data || data.kind === "global")
    return (
      <div className="flex-1 p-5">
        <LoadState
          loading={isLoading}
          error={error}
          retry={() => void mutate().catch(() => {})}
        />
        <Link
          href="/dashboard/messages"
          className="mt-4 block text-sm underline"
        >
          ← {t("К чатам", "Чаттарға")}
        </Link>
      </div>
    );
  return <Conversation id={id} room={data} onRead={refresh} />;
}
