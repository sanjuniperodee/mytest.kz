"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { Room } from './chat-types';
import Link from "next/link";
import useSWRInfinite from "swr/infinite";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  MoreHorizontal,
  Send,
  Trash2,
  Flag,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  formatViews,
  LoadState,
  Page,
  PersonAvatar,
  personName,
  Post,
  profileHref,
  Timestamp,
  useSocialText,
} from "./common";

export function Composer({
  parentId,
  onDone,
}: {
  parentId?: string;
  onDone: () => void | Promise<unknown>;
}) {
  const { user } = useAuth();
  const t = useSocialText();
  const [text, setText] = useState("");
  const [inviteId, setInviteId] = useState("");
  const { data: rooms } = useSWR<Room[]>(!parentId ? '/social/rooms' : null, (path: string) => api<Room[]>(path));
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("invite");
    if (initial) setInviteId(initial);
  }, []);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await api("/social/posts", {
        method: "POST",
        body: {
          body: text.trim(),
          ...(parentId ? { parentId } : {}),
          ...(inviteId ? { groupInviteId: inviteId } : {}),
        },
      });
      setText("");
      setInviteId("");
      await onDone();
      toast.success(t("Опубликовано", "Жарияланды"));
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("Не удалось опубликовать", "Жариялау мүмкін болмады"),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-border bg-background p-4 sm:p-5"
    >
      <div className="flex gap-3">
        {user && (
          <PersonAvatar
            person={{
              id: user.id,
              firstName: user.firstName ?? null,
              lastName: user.lastName ?? null,
              avatarUrl: user.avatarUrl ?? null,
            }}
          />
        )}
        <div className="min-w-0 flex-1">
          <label htmlFor={`compose-${parentId || "post"}`} className="sr-only">
            {t("Текст публикации", "Жарияланым мәтіні")}
          </label>
          <textarea
            id={`compose-${parentId || "post"}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={busy}
            placeholder={
              parentId
                ? t("Поделись своим ответом…", "Жауабыңмен бөліс…")
                : t(
                    "Что нового? Вопрос, мысль или маленькая победа…",
                    "Не жаңалық? Сұрағыңмен не жетістігіңмен бөліс…",
                  )
            }
            className="w-full resize-y rounded-lg bg-transparent p-1 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          {!parentId &&
            rooms?.some(
              (r) =>
                r.title &&
                !r.archived &&
                r.members.some(
                  (m) => m.userId === user?.id && m.role !== "member",
                ),
            ) && (
              <label className="mt-2 block text-xs text-muted-foreground">
                {t("Пригласить в группу", "Топқа шақыру")}
                <select
                  value={inviteId}
                  onChange={(e) => setInviteId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-background p-2 text-sm"
                >
                  <option value="">{t("Без приглашения", "Шақырусыз")}</option>
                  {rooms
                    .filter(
                      (r) =>
                        r.title &&
                        !r.archived &&
                        r.members.some(
                          (m) => m.userId === user?.id && m.role !== "member",
                        ),
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                </select>
              </label>
            )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              {text.length
                ? `${text.length}/2000`
                : t("Твоё мнение важно", "Сенің пікірің маңызды")}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={busy || !text.trim()}
              className="rounded-full gap-2"
            >
              {busy
                ? t("Публикуем…", "Жариялануда…")
                : parentId
                  ? t("Ответить", "Жауап беру")
                  : t("Опубликовать", "Жариялау")}
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

const viewedPosts = new Set<string>();

export function PostCard({
  post,
  refresh,
}: {
  post: Post;
  refresh: () => void | Promise<unknown>;
}) {
  const { user } = useAuth();
  const t = useSocialText();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!post.id || viewedPosts.has(post.id)) return;
    viewedPosts.add(post.id);
    api(`/social/posts/${post.id}/view`, { method: "POST" }).catch(() => {});
  }, [post.id]);
  async function act(
    path: string,
    method: "PUT" | "DELETE" | "POST",
    body?: unknown,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/social/posts/${post.id}${path}`, { method, body });
      await refresh();
      return true;
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("Не удалось сохранить", "Сақтау мүмкін болмады"),
      );
    } finally {
      setBusy(false);
    }
  }
  const href = `/dashboard/community/post/${post.id}`;
  return (
    <article className="border-b border-border p-4 last:border-0 sm:p-5">
      <div className="flex gap-3">
        <Link
          href={profileHref(post.authorId)}
          aria-label={personName(post.author)}
        >
          <PersonAvatar person={post.author} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={profileHref(post.authorId)}
              className="truncate text-sm font-semibold hover:underline"
            >
              {personName(post.author)}
            </Link>
            <span className="shrink-0">
              <Timestamp value={post.createdAt} />
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-9 shrink-0"
                  aria-label={t(
                    "Действия с публикацией",
                    "Жарияланым әрекеттері",
                  )}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {post.authorId === user?.id || user?.isAdmin ? (
                  <DropdownMenuItem
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            "Удалить публикацию?",
                            "Жарияланымды жою керек пе?",
                          ),
                        )
                      )
                        void act("", "DELETE");
                    }}
                  >
                    <Trash2 className="size-4" />
                    {t("Удалить", "Жою")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={busy}
                    onClick={() => {
                      const reason = window.prompt(
                        t(
                          "Что не так с публикацией?",
                          "Жарияланымда не дұрыс емес?",
                        ),
                      );
                      if (reason?.trim())
                        void act("/report", "POST", {
                          reason: reason.trim().slice(0, 500),
                        }).then(
                          (ok) =>
                            ok &&
                            toast.info(
                              t("Жалоба отправлена", "Шағым жіберілді"),
                            ),
                        );
                    }}
                  >
                    <Flag className="size-4" />
                    {t("Пожаловаться", "Шағымдану")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {post.parentId && (
            <Link
              href={`/dashboard/community/post/${post.parentId}`}
              className="text-xs text-muted-foreground hover:underline"
            >
              {t("В ответ на публикацию ↗", "Жарияланымға жауап ↗")}
            </Link>
          )}
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]">
            {post.body}
          </p>
          {post.groupInvite && post.groupInviteToken && (
            <Link
              href={`/dashboard/community/invite/${post.groupInviteToken}`}
              className="mt-3 block rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"
            >
              <p className="text-xs text-muted-foreground">
                {t("Приглашение в группу", "Топқа шақыру")}
              </p>
              <p className="mt-1 break-words text-sm font-semibold">
                {post.groupInvite.title}
              </p>
              <span className="mt-2 block text-xs font-medium">
                {post.groupInvite.archived
                  ? t("Группа закрыта", "Топ жабылған")
                  : t("Посмотреть и присоединиться →", "Көру және қосылу →")}
              </span>
            </Link>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={t("Нравится", "Ұнайды")}
              aria-pressed={post.likes.length > 0}
              className={cn(
                "min-h-10 gap-1.5 rounded-full px-2 text-muted-foreground",
                post.likes.length > 0 && "text-rose-500",
              )}
              onClick={() =>
                void act("/like", post.likes.length ? "DELETE" : "PUT")
              }
            >
              <Heart
                className={cn(
                  "size-[18px]",
                  post.likes.length > 0 && "fill-current",
                )}
              />
              {post._count.likes}
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="min-h-10 gap-1.5 rounded-full px-2 text-muted-foreground"
            >
              <Link href={href} aria-label={t("Комментарии", "Пікірлер")}>
                <MessageCircle className="size-[18px]" />
                {post._count.replies}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={t("Репост", "Репост")}
              aria-pressed={post.reposts.length > 0}
              className={cn(
                "min-h-10 gap-1.5 rounded-full px-2 text-muted-foreground",
                post.reposts.length > 0 && "text-emerald-600",
              )}
              onClick={() =>
                void act("/repost", post.reposts.length ? "DELETE" : "PUT")
              }
            >
              <Repeat2 className="size-[18px]" />
              {post._count.reposts}
            </Button>
            <div
              className="flex min-h-10 items-center gap-1.5 rounded-full px-2 text-xs sm:text-sm text-muted-foreground select-none"
              title={t("Просмотры", "Қаралымдар")}
              aria-label={t("Просмотры", "Қаралымдар")}
            >
              <Eye className="size-[18px]" />
              <span>{formatViews(post.views ?? 0)}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full text-muted-foreground"
              aria-label={t("Поделиться ссылкой", "Сілтемемен бөлісу")}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}${href}`,
                  );
                  toast.success(t("Ссылка скопирована", "Сілтеме көшірілді"));
                } catch {
                  toast.error(
                    t(
                      "Не удалось скопировать ссылку",
                      "Сілтемені көшіру мүмкін болмады",
                    ),
                  );
                }
              }}
            >
              <Share2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function PostList({
  query = "",
  composer = false,
  parentId,
  onChange,
}: {
  query?: string;
  composer?: boolean;
  parentId?: string;
  onChange?: () => void | Promise<unknown>;
}) {
  const t = useSocialText();
  const { data, error, isLoading, isValidating, mutate, size, setSize } =
    useSWRInfinite<Page<Post>>(
      (index, previous) =>
        index > 0 && !previous?.nextCursor
          ? null
          : `/social/posts?${query}${parentId ? `&parentId=${parentId}` : ""}${index ? `&cursor=${previous?.nextCursor}` : ""}`,
      (path: string) => api<Page<Post>>(path),
      { revalidateOnFocus: true },
    );
  const posts = [
    ...new Map(
      data?.flatMap((p) => p.items).map((p) => [p.id, p]) || [],
    ).values(),
  ];
  return (
    <div className="space-y-4" data-no-translate>
      {composer && (
        <Composer
          parentId={parentId}
          onDone={async () => {
            await mutate();
            await onChange?.();
          }}
        />
      )}
      <div className="overflow-hidden rounded-3xl border border-border bg-background">
        <LoadState
          loading={isLoading}
          error={error}
          retry={() => void mutate()}
        />
        {posts.map((post) => (
          <PostCard key={post.id} post={post} refresh={() => mutate()} />
        ))}
        {!isLoading && !error && !posts.length && (
          <div className="px-6 py-14 text-center">
            <MessageCircle className="mx-auto mb-4 size-8 text-muted-foreground/50" />
            <h3 className="font-semibold">
              {t("Здесь начинается разговор", "Әңгіме осы жерден басталады")}
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              {t(
                "Пока публикаций нет. Напиши первым или подпишись на интересных тебе людей.",
                "Әзірге жарияланым жоқ. Бірінші болып жаз немесе қызықты адамдарға жазыл.",
              )}
            </p>
          </div>
        )}
      </div>
      {data?.at(-1)?.nextCursor && (
        <Button
          variant="outline"
          disabled={isValidating}
          className="w-full rounded-full"
          onClick={() => void setSize(size + 1)}
        >
          {isValidating
            ? t("Загрузка…", "Жүктелуде…")
            : t("Показать ещё", "Тағы көрсету")}
        </Button>
      )}
    </div>
  );
}
