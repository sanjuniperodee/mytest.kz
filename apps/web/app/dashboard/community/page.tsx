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
          title={t("Свои люди. Общая цель.", "Өз ортаң. Ортақ мақсат.")}
          description={t(
            "Готовиться легче, когда ты не один.",
            "Бірге дайындалу жеңілірек.",
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
      <div
        role="tablist"
        aria-label={t("Лента", "Лента")}
        className="mb-4 flex gap-2"
      >
        {[
          ["all", t("Все публикации", "Барлық жазбалар")],
          ["following", t("Подписки", "Жазылымдар")],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
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
      <PostList key={tab} query={`tab=${tab}`} composer />
    </CommunityFrame>
  );
}
