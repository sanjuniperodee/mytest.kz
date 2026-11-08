"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useSocialText } from "@/components/social/common";
import { Composer } from "@/components/social/posts";

/** Те же темы, что принимает API для открытых вопросов (domain/topics.ts). */
const PUBLIC_TOPIC_RE = /^(program:[A-Z]{1,2}\d{3}|university:\d{1,5})$/;

export default function AskPage() {
  return (
    <Suspense fallback={null}>
      <AskQuestion />
    </Suspense>
  );
}

/**
 * Вопрос со страницы вуза или специальности. Сюда ведёт «Задать вопрос» с публичной
 * страницы (через вход). Вопрос открытый: появится там и в ленте сообщества.
 */
function AskQuestion() {
  const t = useSocialText();
  const router = useRouter();
  const params = useSearchParams();
  const topic = params.get("topic") ?? "";
  const label = (params.get("label") ?? "").slice(0, 120);
  const valid = PUBLIC_TOPIC_RE.test(topic);

  return (
    <div className="flex min-w-0 max-w-2xl flex-col gap-6" data-no-translate>
      <Link
        href={valid ? `/t/${encodeURIComponent(topic)}` : "/dashboard/community"}
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {valid ? t("К странице с баллами", "Балдар бетіне") : t("К ленте", "Лентаға оралу")}
      </Link>
      <PageHeader
        title={t("Вопрос о поступлении", "Түсу туралы сұрақ")}
        description={
          valid && label
            ? t(`Тема: ${label}`, `Тақырып: ${label}`)
            : t(
                "Откройте страницу вуза или специальности и нажмите «Задать вопрос».",
                "ЖОО немесе мамандық бетін ашып, «Сұрақ қою» батырмасын басыңыз.",
              )
        }
      />
      {valid ? (
        <Composer
          topicKey={topic}
          isPublic
          placeholder={t(
            "Например: хватит ли 95 баллов на грант? Какие предметы лучше сдавать?",
            "Мысалы: 95 балл грантқа жете ме? Қандай пәндерді тапсырған дұрыс?",
          )}
          onDone={() => undefined}
          onCreated={(post) => router.push(`/dashboard/community/post/${post.id}`)}
        />
      ) : (
        <Link href="/prohodnoj-ball-ent" className="text-sm font-medium underline underline-offset-4">
          {t("Проходные баллы по вузам и специальностям", "ЖОО мен мамандықтар бойынша өту балдары")}
        </Link>
      )}
    </div>
  );
}
