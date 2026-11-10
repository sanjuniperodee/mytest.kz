"use client";

import "katex/dist/katex.min.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { CheckCircle2, Flame, MessageCircle, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUiI18n } from "@/lib/i18n/ui";
import { QuestionSource } from "@/components/exam/question-source";
import { useSocialText } from "./common";

export type QuestionOfDay = {
  key: string;
  date: string;
  isToday: boolean;
  subject: { slug: string; ru: string; kk: string };
  topic: { slug: string; name: string; href: string };
  stemHtml: string;
  optionsHtml: string[];
  correct: number;
  explanationHtml: string;
  /** `openstax` — вопрос по учебникам OpenStax (CC BY 4.0), источник показываем всегда. */
  source?: "openstax" | null;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const RICH = "rich-text [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em]";
const ANSWER_KEY = (date: string) => `mytest-qotd-${date}`;
const DAYS_KEY = "mytest-qotd-days";

const fetchJson = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(String(res.status));
    return res.json() as Promise<QuestionOfDay>;
  });

/** Серия дней подряд с ответом на вопрос дня (локально, без сервера). */
function readStreak(today: string): number {
  try {
    const days = new Set<string>(JSON.parse(localStorage.getItem(DAYS_KEY) || "[]"));
    let streak = 0;
    const cursor = new Date(`${today}T12:00:00Z`);
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
  } catch {
    return 0;
  }
}

function rememberAnswer(date: string, choice: number) {
  try {
    localStorage.setItem(ANSWER_KEY(date), String(choice));
    const days: string[] = JSON.parse(localStorage.getItem(DAYS_KEY) || "[]");
    if (!days.includes(date)) localStorage.setItem(DAYS_KEY, JSON.stringify([...days, date].slice(-60)));
  } catch {
    // private mode — ответ просто не запомнится
  }
}

/**
 * «Вопрос дня»: каждый день новый вопрос ЕНТ для всех. Ответил — видишь разбор,
 * серию дней подряд и обсуждение с ответами других. Повод заходить ежедневно.
 */
export function QuestionOfDayCard({ date, showDiscuss = true }: { date?: string; showDiscuss?: boolean }) {
  const t = useSocialText();
  const { locale } = useUiI18n();
  const { data, error, isLoading } = useSWR<QuestionOfDay>(
    `/api/qotd${date ? `?date=${encodeURIComponent(date)}` : ""}`,
    fetchJson,
    // 404 — вопроса на эту дату нет (старые обсуждения): повторять запрос незачем.
    { revalidateOnFocus: false, shouldRetryOnError: (err: Error) => err.message !== "404" },
  );
  const [choice, setChoice] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!data) return;
    const saved = localStorage.getItem(ANSWER_KEY(data.date));
    setChoice(saved != null && saved !== "" ? Number(saved) : null);
    setStreak(readStreak(data.date));
  }, [data]);

  if (isLoading) return <Skeleton className="h-56 rounded-xl" />;
  if (error || !data) return null;

  const answered = choice !== null;
  const right = answered && choice === data.correct;

  const choose = (index: number) => {
    if (answered) return;
    setChoice(index);
    rememberAnswer(data.date, index);
    setStreak(readStreak(data.date));
  };

  return (
    <section
      className="overflow-hidden rounded-xl border border-accent/30 bg-card"
      aria-labelledby={`qotd-${data.date}`}
      data-no-translate
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-accent/5 px-4 py-2.5">
        <h2 id={`qotd-${data.date}`} className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-accent" aria-hidden="true" />
          {data.isToday ? t("Вопрос дня", "Күн сұрағы") : t(`Вопрос дня · ${data.date}`, `Күн сұрағы · ${data.date}`)}
          <span className="font-normal text-muted-foreground">· {t(data.subject.ru, data.subject.kk)}</span>
        </h2>
        {streak > 1 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
            <Flame className="size-3.5" aria-hidden="true" />
            {t(`${streak} дн. подряд`, `${streak} күн қатарынан`)}
          </span>
        )}
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div className={cn(RICH, "text-[15px] leading-relaxed")} dangerouslySetInnerHTML={{ __html: data.stemHtml }} />
        <ul className="grid gap-2">
          {data.optionsHtml.map((html, index) => {
            const isCorrect = index === data.correct;
            const isChosen = index === choice;
            return (
              <li key={index}>
                <button
                  type="button"
                  disabled={answered}
                  onClick={() => choose(index)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    !answered && "border-border hover:border-foreground/40 hover:bg-secondary/50",
                    answered && isCorrect && "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40",
                    answered && isChosen && !isCorrect && "border-rose-400 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40",
                    answered && !isCorrect && !isChosen && "border-border opacity-70",
                  )}
                >
                  <span className="mt-0.5 font-semibold tabular-nums">{LETTERS[index]}</span>
                  <span className={cn(RICH, "min-w-0 flex-1")} dangerouslySetInnerHTML={{ __html: html }} />
                  {answered && isCorrect && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />}
                  {answered && isChosen && !isCorrect && <XCircle className="size-4 shrink-0 text-rose-600" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        {answered && (
          <div className="space-y-3">
            <p className={cn("text-sm font-semibold", right ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
              {right ? t("Верно! Завтра будет новый вопрос.", "Дұрыс! Ертең жаңа сұрақ болады.") : t("Не совсем. Разбор ниже.", "Дұрыс емес. Талдау төменде.")}
            </p>
            <div className={cn(RICH, "rounded-lg bg-secondary/50 p-3 text-sm leading-relaxed")} dangerouslySetInnerHTML={{ __html: data.explanationHtml }} />
          </div>
        )}
        <QuestionSource source={data.source} locale={locale} />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {showDiscuss && (
            <Button asChild size="sm" variant={answered ? "default" : "outline"}>
              <Link href={`/dashboard/community/topic/${encodeURIComponent(data.key)}`}>
                <MessageCircle className="size-4" aria-hidden="true" />
                {answered ? t("Обсудить с другими", "Басқалармен талқылау") : t("Обсуждение", "Талқылау")}
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link href={data.topic.href}>{t(`Тест по теме «${data.topic.name}»`, `«${data.topic.name}» тақырыбы бойынша тест`)}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
