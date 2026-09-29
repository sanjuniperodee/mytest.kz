"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { SegmentedTabs } from "@/components/dashboard/segmented-tabs";
import {
  PersonAvatar,
  personName,
  profileHref,
  useSocialText,
} from "@/components/social/common";
import { PostList } from "@/components/social/posts";
import { useUnreadMessages } from "@/components/social/use-unread";
import type { Profile } from "@/components/profile/profile-view";
import { useAuth } from "@/lib/api/auth-context";
import { api } from "@/lib/api/client";

type Tab = "all" | "following";

export default function CommunityPage() {
  const [tab, setTab] = useState<Tab>("all");
  const t = useSocialText();
  const unread = useUnreadMessages();
  return (
    <div className="flex min-w-0 flex-col gap-6" data-no-translate>
      <PageHeader
        title={t("Сообщество", "Қауымдастық")}
        description={t(
          "Задавайте вопросы, делитесь успехами и готовьтесь к ЕНТ вместе.",
          "Сұрақ қойыңыз, жетістіктеріңізбен бөлісіңіз және ҰБТ-ға бірге дайындалыңыз.",
        )}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/community/people">
                <Users className="size-4" aria-hidden="true" />
                {t("Люди", "Адамдар")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/messages">
                <MessageCircle className="size-4" aria-hidden="true" />
                {t("Сообщения", "Хабарламалар")}
                {unread > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-accent-foreground tabular-nums">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            label={t("Лента", "Лента")}
            className="sm:w-fit"
            items={[
              { value: "all", label: t("Все публикации", "Барлық жазбалар") },
              { value: "following", label: t("Подписки", "Жазылымдар") },
            ]}
          />
          <PostList key={tab} query={`tab=${tab}`} composer />
        </div>
        <aside className="hidden flex-col gap-4 xl:sticky xl:top-8 xl:flex">
          <MyProfileCard />
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            {t(
              "Уважайте собеседников. Не публикуйте чужие личные данные, спам и ответы на действующие экзамены.",
              "Басқаларды құрметтеңіз. Жеке деректерді, спамды және өтіп жатқан емтихан жауаптарын жарияламаңыз.",
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}

function MyProfileCard() {
  const { user } = useAuth();
  const t = useSocialText();
  // Shares the cache entry with the profile page.
  const { data } = useSWR<Profile>(
    user ? `/social/people/${user.id}` : null,
    (path: string) => api<Profile>(path),
  );
  if (!user) return null;
  const person = {
    id: user.id,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <Link href={profileHref(user.id)} className="flex items-center gap-3">
        <PersonAvatar person={person} className="size-12" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{personName(person)}</p>
          <p className="text-xs text-muted-foreground">
            {t("Ваш профиль", "Сіздің профиліңіз")}
          </p>
        </div>
      </Link>
      {data && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            [data._count.socialPosts, t("публикаций", "жазба")],
            [data._count.followers, t("подписчиков", "жазылушы")],
            [data._count.following, t("подписок", "жазылым")],
          ].map(([value, label]) => (
            <div key={String(label)}>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}
      <Button asChild variant="outline" size="sm" className="mt-4 w-full">
        <Link href={profileHref(user.id)}>
          {t("Открыть профиль", "Профильді ашу")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
