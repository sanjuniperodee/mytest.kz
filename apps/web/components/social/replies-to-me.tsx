"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { MessageCircle, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useSocialText } from "./common";
import {
  clearPreviousSocialSeen,
  previousSocialSeen,
  SEEN_EVENT,
  type SocialActivity,
} from "./use-social-activity";

/** «Тебе ответили»: куда пришли ответы с прошлого визита — сразу ссылками на треды. */
export function RepliesToMe() {
  const t = useSocialText();
  const [since, setSince] = useState<string | null>(null);
  // Отметку «был в ленте» ставит оболочка кабинета — её эффект срабатывает после нашего,
  // поэтому перечитываем по событию.
  useEffect(() => {
    const read = () => setSince(previousSocialSeen());
    read();
    window.addEventListener(SEEN_EVENT, read);
    return () => window.removeEventListener(SEEN_EVENT, read);
  }, []);
  const { data } = useSWR<SocialActivity>(
    since ? `/social/activity?since=${encodeURIComponent(since)}` : null,
    (path: string) => api<SocialActivity>(path),
    { revalidateOnFocus: false },
  );
  if (!data || (!data.threads.length && !data.followers)) return null;

  return (
    <section className="rounded-xl border border-accent/30 bg-accent/5 p-4" data-no-translate>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="size-4 text-accent" aria-hidden="true" />
          {data.threads.length ? t("Тебе ответили", "Саған жауап берді") : t("Новые подписчики", "Жаңа жазылушылар")}
        </p>
        <button
          type="button"
          onClick={() => {
            clearPreviousSocialSeen();
            setSince(null);
          }}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t("Скрыть", "Жасыру")}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {data.threads.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {data.threads.map((thread) => (
            <li key={thread.postId}>
              <Link href={`/dashboard/community/post/${thread.postId}`} className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-background/70">
                <span className="min-w-0 truncate">«{thread.excerpt}»</span>
                <span className="shrink-0 text-xs font-semibold text-accent tabular-nums">
                  +{thread.replies}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data.followers > 0 && (
        <Link href="/dashboard/profile" className="mt-2 block px-2 text-sm text-muted-foreground hover:text-foreground">
          {t(`+${data.followers} подписч. — посмотреть профиль`, `+${data.followers} жазылушы — профильді көру`)}
        </Link>
      )}
    </section>
  );
}
