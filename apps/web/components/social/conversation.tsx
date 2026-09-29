"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { ArrowLeft, Globe2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/api/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LoadState,
  PersonAvatar,
  personName,
  profileHref,
  useSocialText,
} from "./common";

import type { Room } from "./chat-types";
import { useConversation } from "./use-conversation";
import { GroupSettings } from "./groups";
import { MediaComposer, MessageMedia } from "./media";
import { ArrowDown, Trash2, Users } from "lucide-react";
export function Conversation({
  id,
  room,
  onRead,
  standalone = false,
}: {
  id: string;
  room?: Room;
  onRead: () => void;
  standalone?: boolean;
}) {
  const { user } = useAuth();
  const t = useSocialText();
  const {
    draft,
    setDraft,
    sending,
    attachment,
    setAttachment,
    mediaBusy,
    setMediaBusy,
    scroller,
    nearBottom,
    markRead,
    messages,
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    size,
    setSize,
    send,
    sendError,
    removeMessage,
    atBottom,
    setAtBottom,
    jumpToLatest,
  } = useConversation(id, onRead);
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!input.current) return;
    input.current.style.height = "auto";
    input.current.style.height = `${Math.min(input.current.scrollHeight, 128)}px`;
    if (nearBottom.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [draft, nearBottom, scroller]);
  const myMember = room?.members.find((m) => m.userId === user?.id);
  const restricted =
    room?.archived ||
    myMember?.muted ||
    (room?.onlyAdminsPost && myMember?.role === "member");
  const other = room?.members.find((m) => m.userId !== user?.id)?.user;
  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      data-testid="conversation"
    >
      <header className="flex h-14 sm:h-16 items-center gap-3 border-b border-border/80 px-3.5 sm:px-4 py-2 bg-background/80 backdrop-blur-xs">
        {!standalone && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 md:hidden"
          >
            <Link
              href="/dashboard/messages"
              aria-label={t("Назад к чатам", "Чаттарға оралу")}
            >
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        )}
        {room?.kind === "group" ? (
          <span className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <Users className="size-4 sm:size-5 text-accent" />
          </span>
        ) : room?.key === "global" ? (
          <span className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Globe2 className="size-4 sm:size-5" />
          </span>
        ) : (
          other && <PersonAvatar person={other} className="size-9 sm:size-10" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">
            {room?.key === "global"
              ? t("Глобальный чат", "Жаһандық чат")
              : room?.title ||
                (other ? (
                  <Link href={profileHref(other.id)}>{personName(other)}</Link>
                ) : (
                  t("Переписка", "Хат алмасу")
                ))}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {room?.kind === "group"
              ? t("Групповой чат", "Топтық чат")
              : room?.key === "global"
                ? t("Место встречи сообщества", "Қауымдастықтың кездесу орны")
                : t("Личная переписка", "Жеке хат алмасу")}
          </p>
        </div>
        {room?.kind === "group" && <GroupSettings id={id} onChange={onRead} />}
      </header>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          setAtBottom(nearBottom.current);
          if (nearBottom.current) markRead();
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-secondary/20 p-3 sm:p-4"
        data-testid="message-history"
        aria-label={t("История сообщений", "Хабарламалар тарихы")}
      >
        <LoadState
          loading={isLoading}
          error={error}
          retry={() => void mutate().catch(() => {})}
        />
        {data?.at(-1)?.nextCursor && (
          <Button
            variant="outline"
            size="sm"
            disabled={isValidating}
            className="mx-auto flex"
            onClick={async () => {
              const el = scroller.current;
              const before = el?.scrollHeight || 0;
              nearBottom.current = false;
              setAtBottom(false);
              try {
                await setSize(size + 1);
              } catch {
                return;
              }
              requestAnimationFrame(() => {
                if (el) el.scrollTop += el.scrollHeight - before;
              });
            }}
          >
            {t("Ранние сообщения", "Алдыңғы хабарламалар")}
          </Button>
        )}
        {!isLoading && !error && !messages.length && (
          <div className="flex h-full min-h-40 flex-col items-center justify-center text-center">
            <MessageCircle className="mb-3 size-9 text-muted-foreground/60" />
            <p className="font-medium">
              {t("Начни с приветствия", "Сәлемдесуден баста")}
            </p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              {t(
                "Хороший разговор может стать началом большой дружбы.",
                "Жақсы әңгіме үлкен достықтың бастауы болуы мүмкін.",
              )}
            </p>
          </div>
        )}
        {messages.map((m, index) => {
          const mine = m.authorId === user?.id;
          const day = new Date(m.createdAt).toLocaleDateString(
            t("ru-RU", "kk-KZ"),
            { day: "numeric", month: "long", timeZone: "Asia/Almaty" },
          );
          const previousDay = index
            ? new Date(messages[index - 1].createdAt).toLocaleDateString(
                t("ru-RU", "kk-KZ"),
                { day: "numeric", month: "long", timeZone: "Asia/Almaty" },
              )
            : null;
          return (
            <div key={m.id} data-message-id={m.id}>
              {day !== previousDay && (
                <p className="my-4 text-center text-xs text-muted-foreground">
                  {day}
                </p>
              )}
              <div
                className={cn(
                  "flex items-end gap-2",
                  mine ? "flex-row-reverse" : "justify-start",
                )}
              >
                <Link
                  href={profileHref(m.authorId)}
                  aria-label={
                    t("Профиль", "Профиль") + ": " + personName(m.author)
                  }
                  className={cn(
                    "shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-ring",
                    mine && "hidden sm:inline-block",
                  )}
                >
                  <PersonAvatar
                    person={m.author}
                    className="size-7 sm:size-8"
                  />
                </Link>
                <div
                  className={cn(
                    "min-w-0 max-w-[88%] sm:max-w-[78%] rounded-2xl px-3.5 py-2 sm:py-2.5",
                    mine
                      ? "rounded-br-xs bg-foreground text-background"
                      : "rounded-bl-xs border border-border/80 bg-background shadow-2xs",
                  )}
                >
                  {!mine && (
                    <Link
                      href={profileHref(m.authorId)}
                      className="mb-1 block text-xs font-semibold text-accent"
                    >
                      {personName(m.author)}
                    </Link>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                    {m.body}
                  </p>
                  {m.attachment && <MessageMedia file={m.attachment} />}
                  {(mine || (myMember && myMember.role !== "member")) && (
                    <button
                      className="mt-1 inline-flex min-h-8 min-w-8 items-center justify-center opacity-60 hover:opacity-100"
                      aria-label={t("Удалить сообщение", "Хабарламаны жою")}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            t(
                              "Удалить сообщение?",
                              "Хабарламаны жою керек пе?",
                            ),
                          )
                        )
                          return;
                        try {
                          await removeMessage(m.id);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Error");
                        }
                      }}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                  <time
                    dateTime={m.createdAt}
                    className="mt-1 block text-right text-[10px] opacity-60"
                  >
                    {new Date(m.createdAt).toLocaleString(t("ru-RU", "kk-KZ"), {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Almaty",
                    })}
                  </time>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!atBottom && (
        <div className="absolute bottom-40 left-1/2 z-10 -translate-x-1/2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shadow-md"
            onClick={jumpToLatest}
          >
            <ArrowDown className="size-4" />
            {t("К новым сообщениям", "Жаңа хабарламаларға")}
          </Button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          if (restricted || !room) {
            e.preventDefault();
            return;
          }
          void send(e);
        }}
        className="border-t border-border/80 bg-background p-2 sm:p-3"
      >
        <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground">
          {t(
            "Модераторы платформы могут просматривать сообщения и вложения.",
            "Платформа модераторлары хабарламалар мен тіркемелерді көре алады.",
          )}
        </p>
        {restricted && (
          <p
            role="status"
            className="mb-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
          >
            {t(
              "Отправка сообщений ограничена администратором.",
              "Хабарлама жіберуді әкімші шектеген.",
            )}
          </p>
        )}
        {sendError && (
          <p role="alert" className="mb-2 text-xs text-destructive">
            {sendError}
          </p>
        )}
        <MediaComposer
          roomId={id}
          attachment={attachment}
          onChange={setAttachment}
          onBusy={setMediaBusy}
          disabled={sending || !!restricted || !room || !!error}
        />
        <div className="flex items-end gap-1.5 rounded-2xl border border-border/80 bg-secondary/30 p-1.5 sm:gap-2 sm:p-2">
          <textarea
            ref={input}
            aria-label={t("Сообщение", "Хабарлама")}
            rows={1}
            maxLength={2000}
            value={draft}
            disabled={sending || !!restricted || !room}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                window.matchMedia("(pointer:fine)").matches
              ) {
                e.preventDefault();
                if (!restricted && room && (draft.trim() || attachment)) {
                  void send(e);
                }
              }
            }}
            placeholder={t("Напиши сообщение…", "Хабарлама жаз…")}
            className="min-h-[38px] max-h-32 min-w-0 flex-1 resize-none rounded-lg bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="submit"
            disabled={
              sending ||
              mediaBusy ||
              (!draft.trim() && !attachment) ||
              !!error ||
              !!restricted ||
              !room
            }
            size="icon"
            className="size-9 shrink-0 rounded-xl transition-transform active:scale-95"
            aria-label={t("Отправить", "Жіберу")}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
