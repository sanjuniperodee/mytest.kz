"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Crown,
  GraduationCap,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Send,
  ShieldBan,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LoadState,
  Person,
  PersonAvatar,
  personName,
  useSocialText,
} from "@/components/social/common";
import { FollowButton, PeopleList } from "@/components/social/people";
import { PostList } from "@/components/social/posts";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { SegmentedTabs } from "@/components/dashboard/segmented-tabs";
import { useAuth } from "@/lib/api/auth-context";
import { api } from "@/lib/api/client";
import { localize } from "@/lib/api/i18n";
import { useUiI18n } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";

type Learning = {
  entAttempts: number;
  /** Null when there is no full attempt, or when it is outside the public top. */
  entBest: {
    rank: number;
    rawScore: number;
    maxScore: number;
    profileSubjects: string[];
  } | null;
};

export type Profile = Person & {
  createdAt: string;
  blocked: boolean;
  unavailable: boolean;
  learning: Learning | null;
  _count: { followers: number; following: number; socialPosts: number };
};

type Section = "posts" | "replies" | "reposts" | "followers" | "following";

/**
 * The single profile page of the platform: identity, ENT progress and
 * community activity. The owner gets the editor; everyone else gets
 * follow / message / block.
 */
export function ProfileView({ id }: { id: string }) {
  const { user } = useAuth();
  const t = useSocialText();
  const isOwn = id === user?.id;
  const { data, error, isLoading, mutate } = useSWR<Profile>(
    `/social/people/${id}`,
    (path: string) => api<Profile>(path),
  );
  const [section, setSection] = useState<Section>("posts");

  return (
    <div className="flex min-w-0 flex-col gap-6" data-no-translate>
      {!isOwn && (
        <Link
          href="/dashboard/community/people"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("Люди", "Адамдар")}
        </Link>
      )}
      {!data && (
        <LoadState
          loading={isLoading}
          error={error}
          retry={() => void mutate()}
        />
      )}
      {data && (
        <>
          <ProfileHeader
            profile={data}
            isOwn={isOwn}
            section={section}
            onSection={setSection}
            refresh={() => mutate()}
          />
          {data.unavailable ? (
            <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
              {t(
                "Взаимодействие с пользователем недоступно",
                "Пайдаланушымен байланысу мүмкін емес",
              )}
            </p>
          ) : (
            <>
              {data.learning && (
                <LearningCard learning={data.learning} isOwn={isOwn} />
              )}
              <Activity
                userId={id}
                name={personName(data)}
                isOwn={isOwn}
                section={section}
                onSection={setSection}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function ProfileHeader({
  profile,
  isOwn,
  section,
  onSection,
  refresh,
}: {
  profile: Profile;
  isOwn: boolean;
  section: Section;
  onSection: (section: Section) => void;
  refresh: () => Promise<unknown>;
}) {
  const { user } = useAuth();
  const { locale } = useUiI18n();
  const t = useSocialText();
  // The owner sees their freshest account data right after editing.
  const person: Person =
    isOwn && user
      ? {
          ...profile,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          avatarUrl: user.avatarUrl ?? null,
        }
      : profile;
  const since = new Date(profile.createdAt).toLocaleDateString(
    locale === "kk" ? "kk-KZ" : "ru-RU",
    { month: "long", year: "numeric" },
  );
  const paid = Boolean(user?.hasActiveSubscription);
  const contact =
    user?.phone || (user?.telegramUsername ? `@${user.telegramUsername}` : null);
  const counters: { key: Section; value: number; label: string }[] = [
    {
      key: "posts",
      value: profile._count.socialPosts,
      label: t("публикаций", "жазба"),
    },
    {
      key: "followers",
      value: profile._count.followers,
      label: t("подписчиков", "жазылушы"),
    },
    {
      key: "following",
      value: profile._count.following,
      label: t("подписок", "жазылым"),
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <PersonAvatar
          person={person}
          className="size-20 text-2xl ring-2 ring-border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
              {personName(person)}
            </h1>
            {isOwn && (
              <Link
                href="/dashboard/billing"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  paid
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                <Crown className="size-3" aria-hidden="true" />
                {localize(
                  user?.currentTariff?.name,
                  locale,
                  paid ? "Premium" : t("Стартовый доступ", "Бастапқы қолжетімділік"),
                )}
              </Link>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {t(`На mytest с ${since}`, `mytest-те ${since} бері`)}
            </span>
            {isOwn && contact && (
              <span
                className="inline-flex items-center gap-1.5"
                title={t("Видно только вам", "Тек сізге көрінеді")}
              >
                {user?.phone ? (
                  <Phone className="size-3.5" aria-hidden="true" />
                ) : (
                  <Send className="size-3.5" aria-hidden="true" />
                )}
                {contact}
              </span>
            )}
          </div>
          {!profile.unavailable && (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {counters.map(({ key, value, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={section === key}
                  onClick={() => onSection(key)}
                  className={cn(
                    "rounded-md hover:underline focus-visible:outline-2 focus-visible:outline-ring",
                    section === key && "underline underline-offset-4",
                  )}
                >
                  <strong className="tabular-nums">{value}</strong>{" "}
                  <span className="text-muted-foreground">{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {isOwn ? (
            <EditProfileDialog onSaved={refresh} />
          ) : (
            <PersonActions profile={profile} refresh={refresh} />
          )}
        </div>
      </div>
    </section>
  );
}

function PersonActions({
  profile,
  refresh,
}: {
  profile: Profile;
  refresh: () => Promise<unknown>;
}) {
  const router = useRouter();
  const t = useSocialText();
  const { mutate: mutateAll } = useSWRConfig();
  const [busy, setBusy] = useState(false);

  const message = async () => {
    setBusy(true);
    try {
      const room = await api<{ id: string }>(
        `/social/rooms/direct/${profile.id}`,
        { method: "POST" },
      );
      router.push(`/dashboard/messages?room=${room.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = async () => {
    if (
      !profile.blocked &&
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
      await api(`/social/people/${profile.id}/block`, {
        method: profile.blocked ? "DELETE" : "PUT",
      });
      await mutateAll(
        (key) => typeof key === "string" && key.startsWith("/social/"),
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!profile.unavailable && (
        <>
          <FollowButton person={profile} refresh={refresh} />
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            className="rounded-full"
            onClick={() => void message()}
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {t("Написать", "Хат жазу")}
          </Button>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label={t("Ещё действия", "Басқа әрекеттер")}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={busy} onClick={() => void toggleBlock()}>
            <ShieldBan className="size-4" />
            {profile.blocked
              ? t("Разблокировать", "Бұғаттан шығару")
              : t("Заблокировать", "Бұғаттау")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function LearningCard({
  learning,
  isOwn,
}: {
  learning: Learning;
  isOwn: boolean;
}) {
  const t = useSocialText();
  const best = learning.entBest;
  const noAttempts = learning.entAttempts === 0;

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card"
      aria-labelledby="profile-learning-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2
          id="profile-learning-title"
          className="flex items-center gap-2 font-semibold"
        >
          <GraduationCap className="size-4 text-muted-foreground" aria-hidden="true" />
          {t("Подготовка к ЕНТ", "ҰБТ-ға дайындық")}
        </h2>
        {isOwn && !noAttempts && (
          <Link
            href="/dashboard/stats"
            className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            {t("Статистика", "Статистика")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      {isOwn && noAttempts ? (
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-md text-sm text-muted-foreground">
            {t(
              "Пройдите полный пробный ЕНТ — лучший результат и место в рейтинге появятся в профиле.",
              "Толық ҰБТ сынағын тапсырыңыз — ең жақсы нәтиже мен рейтингтегі орын профильде көрсетіледі.",
            )}
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/exams">
              {t("Выбрать пробный", "Сынақты таңдау")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 divide-x divide-border">
            <div className="p-4 sm:p-5">
              <dt className="text-xs text-muted-foreground">
                {t("Лучший результат", "Ең жақсы нәтиже")}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {best ? (
                  <>
                    {best.rawScore}
                    <span className="text-base font-normal text-muted-foreground">
                      /{best.maxScore}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="p-4 sm:p-5">
              <dt className="text-xs text-muted-foreground">
                {t("В рейтинге", "Рейтингте")}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {best ? (
                  <Link
                    href="/dashboard/leaderboard"
                    className="inline-flex items-center gap-1.5 hover:underline"
                  >
                    <Trophy className="size-4 text-amber-500" aria-hidden="true" />
                    #{best.rank}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="p-4 sm:p-5">
              <dt className="text-xs text-muted-foreground">
                {t("Пробных ЕНТ", "ҰБТ сынағы")}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {learning.entAttempts}
              </dd>
            </div>
          </dl>
          {best && best.profileSubjects.length > 0 && (
            <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
              {t("Профильные предметы", "Бейіндік пәндер")}:{" "}
              <span className="font-medium text-foreground">
                {best.profileSubjects.join(" · ")}
              </span>
            </p>
          )}
          {!best && !isOwn && learning.entAttempts > 0 && (
            <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
              {t(
                "Результаты показываются в профиле, когда участник входит в топ-100 рейтинга.",
                "Нәтижелер қатысушы рейтингтің үздік 100-іне кірген кезде көрсетіледі.",
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Activity({
  userId,
  name,
  isOwn,
  section,
  onSection,
}: {
  userId: string;
  name: string;
  isOwn: boolean;
  section: Section;
  onSection: (section: Section) => void;
}) {
  const t = useSocialText();

  if (section === "followers" || section === "following")
    return (
      <section className="flex flex-col gap-3" aria-labelledby="profile-relation-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="profile-relation-title" className="font-semibold">
            {section === "followers"
              ? t("Подписчики", "Жазылушылар")
              : t("Подписки", "Жазылымдар")}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => onSection("posts")}>
            <X className="size-4" aria-hidden="true" />
            {t("К публикациям", "Жазбаларға")}
          </Button>
        </div>
        <PeopleList key={section} userId={userId} relation={section} />
      </section>
    );

  return (
    <section className="flex flex-col gap-3">
      <SegmentedTabs
        value={section}
        onChange={onSection}
        label={t("Активность", "Белсенділік")}
        items={[
          { value: "posts", label: t("Публикации", "Жазбалар") },
          { value: "replies", label: t("Ответы", "Жауаптар") },
          { value: "reposts", label: t("Репосты", "Репосттар") },
        ]}
      />
      <div role="tabpanel">
        <PostList
          key={`${userId}-${section}`}
          query={`authorId=${userId}&tab=${section}`}
          toolbar={false}
          empty={{
            title: t("Пока пусто", "Әзірге бос"),
            text: isOwn
              ? t(
                  "Поделитесь вопросом или успехом в ленте — публикации появятся здесь.",
                  "Лентада сұрағыңызбен немесе жетістігіңізбен бөлісіңіз — жазбалар осында шығады.",
                )
              : t(
                  `${name} пока ничего не опубликовал(а) в этом разделе.`,
                  `${name} бұл бөлімде әзірге ештеңе жарияламады.`,
                ),
          }}
        />
      </div>
    </section>
  );
}
