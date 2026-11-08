"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useSocialText } from "@/components/social/common";
import { PostList } from "@/components/social/posts";
import { QuestionOfDayCard } from "@/components/social/question-of-day";

const QOTD_RE = /^qotd:(\d{4}-\d{2}-\d{2})$/;
const PUBLIC_RE = /^(program:[A-Z]{1,2}\d{3}|university:\d{1,5})$/;

/** Обсуждение одной темы: вопрос дня (закрытое) или вуз/специальность (открытые вопросы). */
export default function TopicPage() {
  const params = useParams<{ key: string }>();
  const key = decodeURIComponent(params.key);
  const t = useSocialText();
  const qotd = key.match(QOTD_RE);
  const isPublicTopic = PUBLIC_RE.test(key);

  if (!qotd && !isPublicTopic) {
    return (
      <div className="flex flex-col gap-4" data-no-translate>
        <p className="font-semibold">{t("Такой темы нет", "Мұндай тақырып жоқ")}</p>
        <Link href="/dashboard/community" className="text-sm underline underline-offset-4">
          {t("К ленте", "Лентаға оралу")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 max-w-3xl flex-col gap-6" data-no-translate>
      <Link
        href="/dashboard/community"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("К ленте", "Лентаға оралу")}
      </Link>
      {qotd ? (
        <>
          <QuestionOfDayCard date={qotd[1]} showDiscuss={false} />
          <PostList
            topicKey={key}
            composer
            toolbar
            composerPlaceholder={t(
              "Как ты решал? Поделись ходом решения или спроси, что непонятно…",
              "Қалай шештің? Шешу жолыңмен бөліс немесе түсініксізін сұра…",
            )}
            empty={{
              title: t("Пока никто не обсуждал", "Әзірге ешкім талқыламады"),
              text: t("Напиши первым, как ты решал этот вопрос.", "Бұл сұрақты қалай шешкеніңді бірінші болып жаз."),
            }}
          />
        </>
      ) : (
        <>
          <PageHeader
            title={t("Вопросы о поступлении", "Түсу туралы сұрақтар")}
            description={t(
              "Открытые вопросы по этому вузу или специальности. Их видно и на публичной странице.",
              "Осы ЖОО немесе мамандық бойынша ашық сұрақтар. Олар ашық бетте де көрінеді.",
            )}
          />
          <Link href={`/t/${encodeURIComponent(key)}`} className="w-fit text-sm font-medium underline underline-offset-4">
            {t("Открыть страницу с проходными баллами", "Өту балдары бетін ашу")}
          </Link>
          <PostList
            topicKey={key}
            toolbar
            empty={{
              title: t("Вопросов пока нет", "Әзірге сұрақ жоқ"),
              text: t("Задай первый вопрос на странице вуза или специальности.", "Бірінші сұрақты ЖОО немесе мамандық бетінде қой."),
            }}
          />
        </>
      )}
    </div>
  );
}
