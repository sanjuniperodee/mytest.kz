"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api/client";

const SEEN_KEY = "mytest-social-seen";
export const SEEN_EVENT = "mytest-social-seen";
/** Первый раз (ленту ещё не открывали) считаем активность за последние две недели. */
const FIRST_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function readSince(): string {
  try {
    const saved = localStorage.getItem(SEEN_KEY);
    if (saved && !Number.isNaN(Date.parse(saved))) return saved;
  } catch {
    // ignore
  }
  return new Date(Date.now() - FIRST_WINDOW_MS).toISOString();
}

const PREV_KEY = "mytest-social-prev-seen";
/** Переходы внутри ленты не считаются новым визитом. */
const VISIT_GAP_MS = 5 * 60 * 1000;

/** С какого момента показывать плашку «Тебе ответили» в этот визит. */
export function previousSocialSeen(): string | null {
  try {
    return sessionStorage.getItem(PREV_KEY);
  } catch {
    return null;
  }
}

export function clearPreviousSocialSeen() {
  try {
    sessionStorage.removeItem(PREV_KEY);
  } catch {
    // ignore
  }
}

/** Пользователь открыл ленту — всё, что было до этого момента, считаем увиденным. */
export function markSocialSeen() {
  try {
    const saved = readSince();
    if (Date.now() - Date.parse(saved) > VISIT_GAP_MS) sessionStorage.setItem(PREV_KEY, saved);
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
    window.dispatchEvent(new Event(SEEN_EVENT));
  } catch {
    // ignore
  }
}

/**
 * Ответы на мои посты и новые подписчики с прошлого визита в ленту — бейдж у
 * «Ленты». Без него человек не узнаёт, что ему ответили, и не возвращается.
 */
export type SocialActivity = {
  replies: number;
  followers: number;
  threads: { postId: string; excerpt: string; replies: number }[];
};

export function useSocialActivity(enabled = true) {
  const [since, setSince] = useState<string | null>(null);
  const refreshSince = useCallback(() => setSince(readSince()), []);

  useEffect(() => {
    refreshSince();
    window.addEventListener(SEEN_EVENT, refreshSince);
    window.addEventListener("storage", refreshSince);
    return () => {
      window.removeEventListener(SEEN_EVENT, refreshSince);
      window.removeEventListener("storage", refreshSince);
    };
  }, [refreshSince]);

  const { data } = useSWR<SocialActivity>(
    enabled && since ? `/social/activity?since=${encodeURIComponent(since)}` : null,
    (path: string) => api<SocialActivity>(path),
    { refreshInterval: 60000, refreshWhenHidden: false, shouldRetryOnError: false },
  );
  return (data?.replies ?? 0) + (data?.followers ?? 0);
}
