"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth-context";
import { Button } from "@/components/ui/button";
import {
  LoadState,
  Person,
  PersonAvatar,
  personName,
  profileHref,
  useSocialText,
} from "./common";

export function FollowButton({
  person,
  refresh,
}: {
  person: Person;
  refresh: () => void | Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const t = useSocialText();
  const { user } = useAuth();
  if (person.id === user?.id) return null;
  const following = !!person.followers?.length;
  return (
    <Button
      size="sm"
      variant={following ? "outline" : "default"}
      className="shrink-0 rounded-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/social/people/${person.id}/follow`, {
            method: following ? "DELETE" : "PUT",
          });
          await refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {following
        ? t("Вы подписаны", "Жазылғансыз")
        : t("Подписаться", "Жазылу")}
    </Button>
  );
}
export function PeopleList({
  userId,
  relation,
}: {
  userId?: string;
  relation?: "followers" | "following";
}) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const t = useSocialText();
  useEffect(() => {
    const timer = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const { data, error, isLoading, mutate } = useSWR<Person[]>(
    `/social/people?q=${encodeURIComponent(q)}${userId ? `&userId=${userId}&relation=${relation}` : ""}`,
    (path: string) => api<Person[]>(path),
  );
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <label className="mb-2 flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Поиск по имени", "Аты бойынша іздеу")}
          aria-label={t("Поиск людей", "Адамдарды іздеу")}
          maxLength={100}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <LoadState
        loading={isLoading}
        error={error}
        retry={() => void mutate()}
      />
      {data?.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-3 border-b border-border py-4 last:border-0"
        >
          <Link
            href={profileHref(p.id)}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <PersonAvatar person={p} />
            <span className="truncate text-sm font-semibold">
              {personName(p)}
            </span>
          </Link>
          <FollowButton person={p} refresh={() => mutate()} />
        </div>
      ))}
      {!isLoading && !error && !data?.length && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("Пока никого не нашли", "Әзірге ешкім табылмады")}
        </p>
      )}
    </div>
  );
}
