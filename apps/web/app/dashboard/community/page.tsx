"use client";
import { useState } from "react";
import Link from "next/link";
import { Globe2 } from "lucide-react";
import { useAuth } from "@/lib/api/auth-context";
import {
  CommunityFrame,
  profileHref,
  useSocialText,
} from "@/components/social/common";
import { PostList } from "@/components/social/posts";
import { PageHeader } from "@/components/dashboard/page-header";
import { cn } from "@/lib/utils";
export default function CommunityPage() {
  const [tab, setTab] = useState("all");
  const t = useSocialText();
  const { user } = useAuth();
  return (
    <CommunityFrame>
      <div className="mb-5">
        <PageHeader
          eyebrow="mytest community"
          eyebrowIcon={Globe2}
          title={t("Сообщество", "Қауымдастық")}
          description={t(
            "Задавайте вопросы, обсуждайте подготовку и находите учебную группу.",
            "Сұрақ қойыңыз, дайындықты талқылаңыз және оқу тобын табыңыз.",
          )}
          actions={
            user ? (
              <Link
                href={profileHref(user.id)}
                className="shrink-0 text-xs font-medium underline underline-offset-4"
              >
                {t("Мой профиль", "Менің профилім")}
              </Link>
            ) : undefined
          }
        />
      </div>
      <div aria-label={t("Лента", "Лента")} className="mb-4 flex gap-2">
        {[
          ["all", t("Все публикации", "Барлық жазбалар")],
          ["following", t("Подписки", "Жазылымдар")],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "min-h-11 rounded-lg px-5 text-sm font-medium transition-colors",
              tab === id
                ? "bg-foreground text-background"
                : "bg-background text-muted-foreground border border-border hover:bg-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <PostList query={`tab=${tab}`} composer />
    </CommunityFrame>
  );
}
