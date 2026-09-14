"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Search, MessageCircle, ArrowLeft, ShieldBan } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth-context";
import { Button } from "@/components/ui/button";
import {
  CommunityFrame,
  LoadState,
  Person,
  PersonAvatar,
  personName,
  profileHref,
  useSocialText,
} from "./common";
import { PostList } from "./posts";
import { cn } from "@/lib/utils";

function FollowButton({
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
    <div className="rounded-3xl border border-border bg-background p-4 sm:p-5">
      <label className="mb-4 flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2.5">
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
export function ProfileActivity({ userId }: { userId: string }) {
  const [tab, setTab] = useState("posts");
  const t = useSocialText();
  return (
    <div>
      <div
        className="mb-4 flex border-b border-border"
        role="tablist"
        aria-label={t("Активность", "Белсенділік")}
      >
        {[
          ["posts", t("Посты", "Жазбалар")],
          ["replies", t("Ответы", "Жауаптар")],
          ["reposts", t("Репосты", "Репосттар")],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "min-h-12 flex-1 border-b-2 px-2 text-sm font-medium",
              tab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <PostList
        key={`${userId}-${tab}`}
        query={`authorId=${userId}&tab=${tab}`}
      />
    </div>
  );
}
type Profile = Person & {
  createdAt: string;
  blocked: boolean;
  unavailable: boolean;
  _count: { followers: number; following: number; socialPosts: number };
};
export function SocialProfile({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const t = useSocialText();
  const { mutate: mutateAll } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<Profile>(
    `/social/people/${id}`,
    (path: string) => api<Profile>(path),
  );
  const [relation, setRelation] = useState<"followers" | "following" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  return (
    <CommunityFrame>
      <Link
        href="/dashboard/community/people"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("Все участники", "Барлық қатысушылар")}
      </Link>
      <LoadState
        loading={isLoading}
        error={error}
        retry={() => void mutate()}
      />
      {data && (
        <>
          <div className="mb-5 overflow-hidden rounded-3xl border border-border bg-background">
            <div className="h-20 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-secondary" />
            <div className="px-5 pb-6">
              <PersonAvatar
                person={data}
                className="-mt-8 size-20 border-4 border-background"
              />
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                {personName(data)}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "Участник сообщества mytest",
                  "mytest қауымдастығының мүшесі",
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <button
                  className="hover:underline"
                  onClick={() =>
                    setRelation(relation === "followers" ? null : "followers")
                  }
                >
                  <strong>{data._count.followers}</strong>{" "}
                  {t("подписчиков", "жазылушы")}
                </button>
                <button
                  className="hover:underline"
                  onClick={() =>
                    setRelation(relation === "following" ? null : "following")
                  }
                >
                  <strong>{data._count.following}</strong>{" "}
                  {t("подписок", "жазылым")}
                </button>
                <span>
                  <strong>{data._count.socialPosts}</strong>{" "}
                  {t("постов", "жазба")}
                </span>
              </div>
              {id !== user?.id ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {!data.unavailable && (
                    <>
                      <FollowButton person={data} refresh={() => mutate()} />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        className="rounded-full"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const room = await api<{ id: string }>(
                              `/social/rooms/direct/${id}`,
                              { method: "POST" },
                            );
                            router.push(`/dashboard/messages?room=${room.id}`);
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Error",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <MessageCircle className="size-4" />
                        {t("Написать", "Хат жазу")}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    className="rounded-full text-muted-foreground"
                    onClick={async () => {
                      if (
                        !data.blocked &&
                        !window.confirm(
                          t(
                            "Заблокировать пользователя? Его публикации и личные сообщения будут скрыты.",
                            "Пайдаланушыны бұғаттау керек пе? Оның жазбалары мен жеке хабарламалары жасырылатын болады.",
                          ),
                        )
                      )
                        return;
                      setBusy(true);
                      try {
                        await api(`/social/people/${id}/block`, {
                          method: data.blocked ? "DELETE" : "PUT",
                        });
                        await mutateAll(
                          (key) =>
                            typeof key === "string" &&
                            key.startsWith("/social/"),
                        );
                        await mutate();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Error");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <ShieldBan className="size-4" />
                    {data.blocked
                      ? t("Разблокировать", "Бұғаттан шығару")
                      : t("Заблокировать", "Бұғаттау")}
                  </Button>
                </div>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-full"
                >
                  <Link href="/dashboard/profile">
                    {t("Настройки профиля", "Профиль баптаулары")}
                  </Link>
                </Button>
              )}
            </div>
          </div>
          {data.unavailable ? (
            <p className="p-5 text-sm text-muted-foreground">
              {t(
                "Взаимодействие с пользователем недоступно",
                "Пайдаланушымен байланысу мүмкін емес",
              )}
            </p>
          ) : relation ? (
            <PeopleList userId={id} relation={relation} />
          ) : (
            <ProfileActivity userId={id} />
          )}
        </>
      )}
    </CommunityFrame>
  );
}
