import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { Lock, ShieldCheck } from "lucide-react"
import type { ParentPayLang } from "@bilimland/shared"
import { Logo } from "@/components/landing/logo"
import { ParentPayFlow } from "@/components/parent-pay/parent-pay-flow"
import { fetchParentPayInfo } from "@/lib/parent-pay-server"
import { fetchPlansForParents } from "@/lib/parent-report-server"
import { cn } from "@/lib/utils"

/**
 * «Оплатить за ученика»: ученик присылает родителю ссылку, тот без входа выбирает тариф и
 * платит со своего Kaspi. Ссылка сама по себе даёт право создать платёж в пользу аккаунта,
 * поэтому: noindex, no-referrer (токен не уходит в Referer при переходе в Kaspi), без кэша
 * и без имени ученика в превью мессенджеров.
 */

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Оплата подготовки к ЕНТ",
  description: "Оплатите подготовку к ЕНТ на mytest со своего Kaspi — без регистрации.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  openGraph: {
    type: "website",
    siteName: "mytest",
    title: "Оплата подготовки к ЕНТ · ҰБТ-ға дайындық төлемі",
    description: "Выберите тариф и оплатите в Kaspi — доступ откроется в аккаунте ученика сразу.",
  },
}

const PLAN_RE = /^[a-z0-9_-]{1,40}$/i

export default async function ParentPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ lang?: string | string[]; plan?: string | string[] }>
}) {
  const [{ token }, query, requestHeaders] = await Promise.all([params, searchParams, headers()])
  const lang: ParentPayLang = query.lang === "kk" ? "kk" : "ru"
  const t = (ru: string, kk: string) => (lang === "kk" ? kk : ru)
  const requestedPlan = typeof query.plan === "string" && PLAN_RE.test(query.plan) ? query.plan : null
  // IP родителя для лимита запросов в API: x-real-ip / последний адрес, добавленный nginx (первый подделывается).
  const clientIp =
    requestHeaders.get("x-real-ip")?.trim() ||
    requestHeaders.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    null

  const [result, plans] = await Promise.all([fetchParentPayInfo(token, clientIp), fetchPlansForParents(lang)])
  // Без списка тарифов платить нечем — но уже начатый или оплаченный платёж показать можем.
  const usable = result.status === "ok" && (plans.length > 0 || result.info.order !== null)
  const langHref = (code: ParentPayLang) =>
    `?lang=${code}${requestedPlan ? `&plan=${encodeURIComponent(requestedPlan)}` : ""}`

  return (
    <div lang={lang} className="min-h-screen bg-background text-foreground" data-no-translate>
      <header className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pt-5 sm:pt-8">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight" aria-label="mytest">
          <Logo className="size-7" />
          <span>mytest</span>
        </Link>
        <nav
          aria-label={t("Язык страницы", "Бет тілі")}
          className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-medium"
        >
          {(["ru", "kk"] as const).map((code) => (
            <Link
              key={code}
              href={langHref(code)}
              replace
              scroll={false}
              aria-current={lang === code ? "true" : undefined}
              className={cn(
                "inline-flex min-h-8 min-w-11 items-center justify-center rounded-full px-3 transition-colors",
                lang === code ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {code === "ru" ? "RU" : "ҚАЗ"}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-6 sm:gap-5 sm:pt-8">
        {result.status === "ok" && usable ? (
          <>
            {/* Без key: при смене языка компонент остаётся на месте и начатый платёж не сбрасывается. */}
            <ParentPayFlow
              token={token}
              lang={lang}
              info={result.info}
              plans={plans}
              initialPlan={requestedPlan && plans.some((p) => p.id === requestedPlan) ? requestedPlan : null}
            />
            <footer className="flex items-start gap-3 px-1 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                {t(
                  "Оплата проходит в приложении Kaspi — данные карты мы не видим и не храним. Платёж разовый: подписки и автосписаний нет.",
                  "Төлем Kaspi қосымшасында өтеді — карта деректерін біз көрмейміз әрі сақтамаймыз. Төлем бір реттік: жазылым да, автоматты есептен шығару да жоқ.",
                )}{" "}
                <Link href="/support" className="underline underline-offset-4 hover:text-foreground">
                  {t("Вопросы по оплате — в поддержку", "Төлем бойынша сұрақтар — қолдау қызметіне")}
                </Link>
                {" · "}
                <Link href="/" className="underline underline-offset-4 hover:text-foreground">
                  {t("Что такое mytest", "mytest деген не")}
                </Link>
              </p>
            </footer>
          </>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
            <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
            <h1 className="mt-3 text-xl font-semibold tracking-tight">
              {result.status === "not_found"
                ? t("Ссылка на оплату больше не действует", "Төлем сілтемесі енді жарамсыз")
                : t("Оплата временно недоступна", "Төлем уақытша қолжетімсіз")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {result.status === "not_found"
                ? t(
                    "Ссылка действует 30 дней или скопирована не полностью. Попросите ученика прислать новую: в личном кабинете mytest, раздел «Тарифы».",
                    "Сілтеме 30 күн жарамды немесе толық көшірілмеген. Оқушыдан жаңасын жіберуін сұраңыз: mytest жеке кабинеті, «Тарифтер» бөлімі.",
                  )
                : t(
                    "Не получилось загрузить тарифы. Обновите страницу через пару минут — ссылка останется рабочей.",
                    "Тарифтерді жүктеу мүмкін болмады. Бірнеше минуттан кейін бетті жаңартыңыз — сілтеме жұмыс істей береді.",
                  )}
            </p>
            <Link
              href="/support"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary/70"
            >
              {t("Написать в поддержку", "Қолдау қызметіне жазу")}
            </Link>
          </section>
        )}
      </main>
    </div>
  )
}
