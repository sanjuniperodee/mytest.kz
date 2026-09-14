"use client";

import Link from "next/link";
import { MessageCircle, Users, ArrowUpRight, Globe2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
};
export type Page<T> = { items: T[]; nextCursor: string | null };
export const personName = (p: Person) =>
  [p.firstName, p.lastName].filter(Boolean).join(" ") || "mytest user";
export const profileHref = (id: string) => `/dashboard/community/people/${id}`;
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
    <Avatar className={cn("size-10 shrink-0 border border-border", className)}>
      <AvatarImage src={resolveMediaUrl(person.avatarUrl)} alt="" />
      <AvatarFallback className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
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
export function SocialNav() {
  const pathname = usePathname();
  const t = useSocialText();
  return (
    <nav
      aria-label={t("Сообщество", "Қауымдастық")}
      className="mb-5 flex gap-1 rounded-2xl border border-border bg-background p-1.5"
    >
      {[
        {
          href: "/dashboard/global-chat",
          text: t("Глобальный чат", "Жаһандық чат"),
          icon: MessageCircle,
        },
        {
          href: "/dashboard/community",
          text: t("Лента", "Лента"),
          icon: Globe2,
        },
        {
          href: "/dashboard/community/people",
          text: t("Люди", "Адамдар"),
          icon: Users,
        },
        {
          href: "/dashboard/messages",
          text: t("Сообщения", "Хабарламалар"),
          icon: MessageCircle,
        },
      ].map(({ href, text, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1 text-xs font-medium transition-colors hover:bg-secondary sm:gap-2 sm:px-2 sm:text-sm",
            pathname === href &&
              "bg-foreground text-background hover:bg-foreground/90",
          )}
        >
          <Icon className="hidden size-4 shrink-0 sm:block" />
          <span>{text}</span>
        </Link>
      ))}
    </nav>
  );
}
export function CommunityFrame({ children }: { children: React.ReactNode }) {
  const t = useSocialText();
  return (
    <div className="mx-auto max-w-5xl" data-no-translate>
      <SocialNav />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">{children}</div>
        <aside className="hidden space-y-4 xl:block">
          <div className="rounded-3xl bg-emerald-500/10 p-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
              mytest community
            </span>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">
              {t("Вместе ближе к цели", "Мақсатқа бірге жақындайық")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(
                "Задавай вопросы, делись маленькими победами и находи своих людей.",
                "Сұрақ қой, жетістіктеріңмен бөліс және достар тап.",
              )}
            </p>
            <Link
              href="/dashboard/community/people"
              className="mt-5 flex items-center gap-2 text-sm font-semibold"
            >
              {t("Найти единомышленников", "Пікірлестерді табу")}
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="px-2 text-xs leading-relaxed text-muted-foreground">
            {t(
              "Уважай собеседников. Не публикуй чужие личные данные, спам и ответы на действующие экзамены.",
              "Басқаларды құрметте. Жеке деректерді, спамды және өтіп жатқан емтихан жауаптарын жариялама.",
            )}
          </div>
        </aside>
      </div>
    </div>
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
        className="rounded-2xl border border-destructive/30 p-5 text-sm"
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
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl bg-secondary"
          />
        ))}
      </div>
    );
  return null;
}
