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
import { useConversation } from "./use-conversation";
import { GroupSettings } from "./groups";
import { MediaComposer, MessageMedia } from "./media";
import { Trash2, Users } from "lucide-react";
export function Conversation({
  id,
  room,
  onRead,
}: {
  id: string;
  room?: Room;
  onRead: () => void;
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
  } = useConversation(id, onRead);
  const myMember = room?.members.find((m) => m.userId === user?.id);
  const restricted =
    room?.archived ||
    myMember?.muted ||
    (room?.onlyAdminsPost && myMember?.role === "member");
  const other = room?.members.find((m) => m.userId !== user?.id)?.user;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex min-h-18 items-center gap-3 border-b border-border px-4 py-3">
        <Button asChild variant="ghost" size="icon" className="md:hidden">
          <Link
            href="/dashboard/messages"
            aria-label={t("Назад к чатам", "Чаттарға оралу")}
          >
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        {room?.title ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            <Users className="size-5 text-emerald-600" />
          </span>
        ) : room?.key === "global" ? (
          <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <Globe2 className="size-5" />
          </span>
        ) : (
          other && <PersonAvatar person={other} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">
            {room?.title ||
              (room?.key === "global" ? (
                t("Общий чат", "Ортақ чат")
              ) : other ? (
                <Link href={profileHref(other.id)}>{personName(other)}</Link>
              ) : (
                t("Переписка", "Хат алмасу")
              ))}
          </h2>
          <p className="text-xs text-muted-foreground">
            {room?.title
              ? t("Групповой чат", "Топтық чат")
              : room?.key === "global"
                ? t("Место встречи сообщества", "Қауымдастықтың кездесу орны")
                : t("Личная переписка", "Жеке хат алмасу")}
          </p>
        </div>
        {room?.title && <GroupSettings id={id} onChange={onRead} />}
      </header>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          if (nearBottom.current) markRead();
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-secondary/20 p-4"
      >
        <LoadState
          loading={isLoading}
          error={error}
          retry={() => void mutate()}
        />
        {data?.at(-1)?.nextCursor && (
          <Button
            variant="outline"
            size="sm"
            disabled={isValidating}
            className="mx-auto flex rounded-full"
            onClick={async () => {
              const el = scroller.current;
              const before = el?.scrollHeight || 0;
              nearBottom.current = false;
              await setSize(size + 1);
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
            <MessageCircle className="mb-3 size-9 text-emerald-600/60" />
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
        {messages.map((m) => {
          const mine = m.authorId === user?.id;
          return (
            <div
              key={m.id}
              className={cn("flex", mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-2.5 sm:max-w-[78%]",
                  mine
                    ? "rounded-br-sm bg-foreground text-background"
                    : "rounded-bl-sm border border-border bg-background",
                )}
              >
                {!mine && (
                  <Link
                    href={profileHref(m.authorId)}
                    className="mb-1 block text-xs font-semibold text-emerald-600"
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
                          t("Удалить сообщение?", "Хабарламаны жою керек пе?"),
                        )
                      )
                        return;
                      try {
                        await api(`/social/rooms/${id}/messages/${m.id}`, {
                          method: "DELETE",
                        });
                        await mutate();
                        onRead();
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
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={send}
        className="border-t border-border bg-background p-3"
      >
        <p className="mb-1 text-[10px] text-muted-foreground">
          {t(
            "Модераторы платформы могут просматривать сообщения и вложения.",
            "Платформа модераторлары хабарламалар мен тіркемелерді көре алады.",
          )}
        </p>
        {restricted && (
          <p role="status" className="mb-2 text-xs text-amber-600">
            {t(
              "Отправка сообщений ограничена администратором.",
              "Хабарлама жіберуді әкімші шектеген.",
            )}
          </p>
        )}
        <MediaComposer
          roomId={id}
          attachment={attachment}
          onChange={setAttachment}
          onBusy={setMediaBusy}
          disabled={sending || !!restricted}
        />
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-secondary/30 p-2">
          <textarea
            aria-label={t("Сообщение", "Хабарлама")}
            rows={2}
            maxLength={2000}
            value={draft}
            disabled={sending || !!restricted}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("Напиши сообщение…", "Хабарлама жаз…")}
            className="max-h-32 min-w-0 flex-1 resize-none rounded-lg bg-transparent p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="submit"
            disabled={
              sending ||
              mediaBusy ||
              (!draft.trim() && !attachment) ||
              !!error ||
              !!restricted
            }
            size="icon"
            className="mb-1 rounded-xl"
            aria-label={t("Отправить", "Жіберу")}
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-1 text-right text-[10px] text-muted-foreground">
          {draft.length}/2000
        </p>
      </form>
    </div>
  );
}
