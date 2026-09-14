"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/api/auth-context";
import {
  CommunityFrame,
  profileHref,
  useSocialText,
} from "@/components/social/common";
import { PostList } from "@/components/social/posts";
import { cn } from "@/lib/utils";
export default function CommunityPage() {
  const [tab, setTab] = useState("all");
  const t = useSocialText();
  const { user } = useAuth();
  return (
    <CommunityFrame>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-600">
            mytest community
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("Свои люди. Общая цель.", "Өз ортаң. Ортақ мақсат.")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "Готовиться легче, когда ты не один.",
              "Бірге дайындалу жеңілірек.",
            )}
          </p>
        </div>
        {user && (
          <Link
            href={profileHref(user.id)}
            className="shrink-0 text-xs font-medium underline underline-offset-4"
          >
            {t("Мой профиль", "Менің профилім")}
          </Link>
        )}
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
              "min-h-11 rounded-full px-5 text-sm font-medium",
              tab === id
                ? "bg-foreground text-background"
                : "bg-background text-muted-foreground border border-border",
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
