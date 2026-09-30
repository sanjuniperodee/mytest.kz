"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveMediaUrl } from "@/lib/api/client";
import { useUiI18n } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";

export type Person = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  followers?: { followerId: string }[];
};
export type Post = {
  groupInvite?: { id: string; title: string | null; archived: boolean } | null;
  groupInviteToken?: string | null;
  id: string;
  body: string;
  authorId: string;
  parentId: string | null;
  createdAt: string;
  author: Person;
  _count: { likes: number; replies: number; reposts: number };
  likes: { userId: string }[];
  reposts: { userId: string }[];
  views?: number;
};
export function formatViews(views?: number): string {
  const n = views ?? 0;
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const m = n / 1_000_000;
  return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
}
export type Page<T> = { items: T[]; nextCursor: string | null };
export const personName = (p: Person) =>
  [p.firstName, p.lastName].filter(Boolean).join(" ") || "mytest user";
// Everyone, including the current user, has one profile page.
export const profileHref = (id: string) => `/dashboard/profile/${id}`;
export function useSocialText() {
  const { locale } = useUiI18n();
  return (ru: string, kk: string) => (locale === "kk" ? kk : ru);
}
export function PersonAvatar({
  person,
  className,
}: {
  person: Person;
  className?: string;
}) {
  return (
    <Avatar
      className={cn("size-10 shrink-0 border border-border text-xs", className)}
    >
      <AvatarImage src={resolveMediaUrl(person.avatarUrl)} alt="" />
      {/* Initials inherit the font size, so larger avatars get larger initials. */}
      <AvatarFallback className="bg-secondary font-semibold text-foreground">
        {personName(person).slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
export function Timestamp({ value }: { value: string }) {
  const { locale } = useUiI18n();
  return (
    <time
      dateTime={value}
      title={new Date(value).toLocaleString(
        locale === "kk" ? "kk-KZ" : "ru-RU",
      )}
      className="text-xs text-muted-foreground"
    >
      {new Date(value).toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-RU", {
        day: "numeric",
        month: "short",
      })}
    </time>
  );
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  retry: () => void;
}) {
  const t = useSocialText();
  if (error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/30 p-5 text-sm"
      >
        <p>
          {error instanceof Error
            ? error.message
            : t(
                "Не удалось загрузить данные",
                "Деректерді жүктеу мүмкін болмады",
              )}
        </p>
        <Button variant="outline" onClick={retry} className="mt-3">
          {t("Повторить", "Қайталау")}
        </Button>
      </div>
    );
  if (loading)
    return (
      <div
        role="status"
        aria-label={t("Загрузка", "Жүктелуде")}
        className="space-y-3 p-5"
      >
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  return null;
}
