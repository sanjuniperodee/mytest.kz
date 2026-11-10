"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import QRCode from "react-qr-code"
import { Check, CheckCircle2, ExternalLink, Loader2, QrCode, RefreshCw, Smartphone, TimerOff } from "lucide-react"
import {
  normalizeKzPhone,
  type BillingPlanDto,
  type ParentPayInfoDto,
  type ParentPayLang,
  type ParentPayOrderDto,
} from "@bilimland/shared"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api/client"
import { recordPublicFunnelEvent } from "@/lib/api/analytics"
import { cn } from "@/lib/utils"

/**
 * «Оплатить за ученика»: родитель открыл ссылку /pay/<token> без входа. Здесь он выбирает
 * тариф и платит со своего Kaspi — по кнопке (приложение Kaspi / QR) или счётом на номер.
 * Платёж создаётся только по нажатию: ссылка Kaspi живёт 5 минут, поэтому заранее её не делаем.
 */

type Method = "qr" | "invoice"
type Notice = "failed" | "fallback_qr" | "gone" | null

const POLL_MS = 3000
/** После истечения QR ещё немного ждём: оплату могли подтвердить в последнюю секунду. */
const POLL_AFTER_EXPIRY_MS = 90_000

function formatKzt(n: number) {
  return `${n.toLocaleString("ru-RU")} ₸`
}

function ruDays(n: number) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return "дней"
  if (last === 1) return "день"
  if (last >= 2 && last <= 4) return "дня"
  return "дней"
}

function formatDate(iso: string, lang: ParentPayLang, withTime = false) {
  return new Intl.DateTimeFormat(lang === "kk" ? "kk-KZ" : "ru-RU", {
    day: "numeric",
    month: "long",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }),
    timeZone: "Asia/Almaty",
  }).format(new Date(iso))
}

/** Маска номера не должна рваться посреди строки («+7» на одной, остальное на другой). */
function nowrap(text: string) {
  return text.replace(/ /g, "\u00A0")
}

function formatLeft(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

export function ParentPayFlow({
  token,
  lang,
  info,
  plans,
  initialPlan,
}: {
  token: string
  lang: ParentPayLang
  info: ParentPayInfoDto
  plans: BillingPlanDto[]
  initialPlan: string | null
}) {
  const t = (ru: string, kk: string) => (lang === "kk" ? kk : ru)
  const base = `/public/parent-pay/${encodeURIComponent(token)}`

  const [order, setOrder] = useState<ParentPayOrderDto | null>(info.order)
  const [planId, setPlanId] = useState<string>(() => {
    const known = (code: string | null | undefined) => (code && plans.some((p) => p.id === code) ? code : null)
    return (
      known(initialPlan) ??
      known(info.order?.planCode) ??
      plans.find((p) => p.highlight)?.id ??
      plans[0]?.id ??
      ""
    )
  })
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState<Method | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [showQr, setShowQr] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkedOnce, setCheckedOnce] = useState(false)
  // Время сервера: null до гидратации, чтобы разметка сервера и браузера совпала.
  const [nowMs, setNowMs] = useState<number | null>(null)
  const clockOffset = useRef(0)
  const orderIdRef = useRef<string | null>(info.order?.orderId ?? null)

  const plan = plans.find((p) => p.id === planId) ?? null
  const pending = order?.status === "pending"
  const expiresMs = order?.expiresAt ? Date.parse(order.expiresAt) : null
  const expiresRef = useRef<number | null>(expiresMs)
  expiresRef.current = pending ? expiresMs : null

  const applyOrder = useCallback((next: ParentPayOrderDto) => {
    const server = Date.parse(next.serverTime)
    if (Number.isFinite(server)) clockOffset.current = server - Date.now()
    if (next.status === "failed" || next.status === "cancelled") {
      // Сорвавшийся платёж не показываем как ошибку — человек просто создаёт новый.
      orderIdRef.current = null
      setOrder(null)
      setNotice("failed")
      return
    }
    orderIdRef.current = next.orderId
    setOrder(next)
  }, [])

  useEffect(() => {
    void recordPublicFunnelEvent("parent_pay_opened", { lang, ...(initialPlan ? { plan: initialPlan } : {}) })
    if (info.order) {
      const server = Date.parse(info.order.serverTime)
      if (Number.isFinite(server)) clockOffset.current = server - Date.now()
    }
    setNowMs(Date.now() + clockOffset.current)
    // Отметка об открытии — один раз на загрузку страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshOrder = useCallback(async (): Promise<void> => {
    const orderId = orderIdRef.current
    if (!orderId) return
    try {
      const next = await api<ParentPayOrderDto>(`${base}/orders/${encodeURIComponent(orderId)}`, { auth: false })
      // Пока шёл запрос, могли создать другой платёж — устаревший ответ не применяем.
      if (orderIdRef.current === next.orderId) applyOrder(next)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && orderIdRef.current === orderId) {
        orderIdRef.current = null
        setOrder(null)
        setNotice(err.code === "PARENT_PAY_NOT_FOUND" ? "gone" : "failed")
      }
      // Сеть моргнула или сработал лимит — следующий опрос попробует снова.
    }
  }, [applyOrder, base])

  // Статус сам: раз в несколько секунд, пока вкладка на экране, и сразу при возврате из Kaspi.
  useEffect(() => {
    if (!pending) return
    const check = () => {
      if (document.visibilityState !== "visible") return
      const expires = expiresRef.current
      if (expires != null && Date.now() + clockOffset.current > expires + POLL_AFTER_EXPIRY_MS) return
      void refreshOrder()
    }
    const timer = window.setInterval(check, POLL_MS)
    document.addEventListener("visibilitychange", check)
    window.addEventListener("pageshow", check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("pageshow", check)
    }
  }, [pending, refreshOrder])

  // Обратный отсчёт для QR.
  useEffect(() => {
    if (!pending || expiresMs == null) return
    setNowMs(Date.now() + clockOffset.current)
    const timer = window.setInterval(() => setNowMs(Date.now() + clockOffset.current), 1000)
    return () => window.clearInterval(timer)
  }, [pending, expiresMs])

  const checkoutError = (err: unknown): string => {
    const code = err instanceof ApiError ? err.code : undefined
    const status = err instanceof ApiError ? err.status : 0
    switch (code) {
      case "PLAN_NOT_FOUND":
        return t(
          "Этот тариф больше не продаётся. Обновите страницу и выберите другой.",
          "Бұл тариф енді сатылмайды. Бетті жаңартып, басқасын таңдаңыз.",
        )
      case "INVALID_PHONE":
        return t(
          "Проверьте номер: нужен мобильный номер Казахстана, например +7 707 123 45 67.",
          "Нөмірді тексеріңіз: Қазақстанның ұялы нөмірі керек, мысалы +7 707 123 45 67.",
        )
      case "INVOICE_FAILED":
        return t(
          "Kaspi не смог выставить счёт на этот номер. Проверьте номер или оплатите кнопкой «Оплатить в Kaspi».",
          "Kaspi бұл нөмірге шот жібере алмады. Нөмірді тексеріңіз немесе «Kaspi арқылы төлеу» батырмасымен төлеңіз.",
        )
      case "KASPI_UNAVAILABLE":
        return t(
          "Kaspi сейчас не отвечает. Попробуйте ещё раз через пару минут.",
          "Kaspi қазір жауап бермей тұр. Бірнеше минуттан кейін қайталап көріңіз.",
        )
      case "PARENT_PAY_LIMIT":
        return t(
          "Сегодня по этой ссылке создано слишком много платежей. Попробуйте завтра или напишите в поддержку.",
          "Бүгін бұл сілтеме бойынша тым көп төлем жасалды. Ертең қайталап көріңіз немесе қолдау қызметіне жазыңыз.",
        )
      case "PARENT_PAY_UNAVAILABLE":
        return t(
          "Оплата временно недоступна. Попробуйте чуть позже.",
          "Төлем уақытша қолжетімсіз. Сәл кейінірек қайталап көріңіз.",
        )
      case "PARENT_PAY_NOT_FOUND":
        return t(
          "Ссылка больше не действует. Попросите ученика прислать новую из раздела «Тарифы».",
          "Сілтеме енді жарамсыз. Оқушыдан «Тарифтер» бөлімінен жаңасын жіберуін сұраңыз.",
        )
    }
    if (status === 429) {
      return t(
        "Слишком много попыток подряд. Подождите минуту и попробуйте снова.",
        "Қатарынан тым көп әрекет жасалды. Бір минут күтіп, қайталап көріңіз.",
      )
    }
    return t(
      "Не удалось создать платёж. Проверьте интернет и попробуйте ещё раз.",
      "Төлем жасалмады. Интернетті тексеріп, қайталап көріңіз.",
    )
  }

  const startCheckout = async (method: Method, forPlan = planId) => {
    if (busy || !forPlan) return
    setError(null)
    setNotice(null)
    let phoneNumber: string | undefined
    if (method === "invoice") {
      const normalized = normalizeKzPhone(phone)
      if (!normalized) {
        setError(
          t(
            "Проверьте номер: нужен мобильный номер Казахстана, например +7 707 123 45 67.",
            "Нөмірді тексеріңіз: Қазақстанның ұялы нөмірі керек, мысалы +7 707 123 45 67.",
          ),
        )
        return
      }
      phoneNumber = normalized
    }
    setBusy(method)
    void recordPublicFunnelEvent("parent_pay_checkout", { plan: forPlan, placement: method, lang })
    try {
      const created = await api<ParentPayOrderDto>(`${base}/checkout`, {
        method: "POST",
        auth: false,
        body: { planId: forPlan, method, ...(phoneNumber ? { phoneNumber } : {}) },
      })
      setShowQr(false)
      setCheckedOnce(false)
      applyOrder(created)
      // Счёт на номер не создался — сервер сам переключил оплату на ссылку Kaspi.
      if (method === "invoice" && created.status === "pending" && created.paymentType === "qr") {
        setNotice("fallback_qr")
      }
    } catch (err) {
      setError(checkoutError(err))
    } finally {
      setBusy(null)
    }
  }

  const checkNow = async () => {
    if (checking) return
    setChecking(true)
    try {
      await refreshOrder()
    } finally {
      setChecking(false)
      setCheckedOnce(true)
    }
  }

  const backToChoice = () => {
    if (order && plans.some((p) => p.id === order.planCode)) setPlanId(order.planCode)
    orderIdRef.current = null
    setOrder(null)
    setError(null)
    setNotice(null)
    setCheckedOnce(false)
  }

  const planName = (o: ParentPayOrderDto) => plans.find((p) => p.id === o.planCode)?.name ?? o.planName
  const student = info.studentName

  const noticeText =
    notice === "failed"
      ? t(
          "Прошлый платёж не завершён: Kaspi его отменил или вышло время. Можно создать новый.",
          "Алдыңғы төлем аяқталмады: Kaspi оны болдырмады немесе уақыты өтіп кетті. Жаңасын жасауға болады.",
        )
      : notice === "fallback_qr"
        ? t(
            "Счёт на этот номер выставить не удалось — оплатите по кнопке ниже.",
            "Бұл нөмірге шот жіберу мүмкін болмады — төмендегі батырма арқылы төлеңіз.",
          )
        : notice === "gone"
          ? t(
              "Ссылка больше не действует. Попросите ученика прислать новую из раздела «Тарифы».",
              "Сілтеме енді жарамсыз. Оқушыдан «Тарифтер» бөлімінен жаңасын жіберуін сұраңыз.",
            )
          : null

  // ---------- Оплачено ----------
  if (order?.status === "paid") {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-50 sm:p-8" aria-live="polite">
        <CheckCircle2 className="size-8" aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{t("Оплата прошла — спасибо!", "Төлем өтті — рақмет!")}</h1>
        <p className="mt-2 text-sm leading-relaxed opacity-90">
          {t(
            `Тариф «${planName(order)}» уже открыт в аккаунте ученика${student ? ` (${student})` : ""}. Больше ничего делать не нужно — можно заниматься.`,
            `«${planName(order)}» тарифі оқушының аккаунтында${student ? ` (${student})` : ""} ашылды. Басқа ештеңе істеудің қажеті жоқ — дайындықты бастай беруге болады.`,
          )}
        </p>
        <dl className="mt-4 grid gap-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="opacity-70">{t("Сумма", "Сома")}</dt>
            <dd className="font-medium tabular-nums">{formatKzt(order.amount)}</dd>
          </div>
          {order.paidAt && (
            <div className="flex justify-between gap-4">
              <dt className="opacity-70">{t("Оплачено", "Төленді")}</dt>
              <dd className="font-medium">{formatDate(order.paidAt, lang, true)}</dd>
            </div>
          )}
        </dl>
      </section>
    )
  }

  // ---------- Ждём оплату ----------
  if (order && pending) {
    const isQr = order.paymentType === "qr"
    const left = expiresMs != null && nowMs != null ? expiresMs - nowMs : null
    const expired = isQr && left != null && left <= 0
    const payUrl = isQr ? order.payUrl : null

    return (
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-live="polite">
        <p className="text-sm text-muted-foreground">
          {t(`Тариф «${planName(order)}»`, `«${planName(order)}» тарифі`)}
          {student ? ` · ${t("ученик", "оқушы")}: ${student}` : ""}
        </p>

        {noticeText && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            {noticeText}
          </p>
        )}

        {isQr ? (
          expired || !payUrl ? (
            <>
              <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <TimerOff className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                {expired
                  ? t("Время на оплату вышло", "Төлем уақыты аяқталды")
                  : t("Ссылка на оплату не пришла", "Төлем сілтемесі келмеді")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {expired
                  ? t(
                      "Ссылка Kaspi действует 5 минут. Получите новую — это пара секунд. Если вы успели оплатить, статус обновится здесь сам.",
                      "Kaspi сілтемесі 5 минут жарамды. Жаңасын алыңыз — бірнеше секунд қана. Төлеп үлгерсеңіз, мәртебе осы жерде өздігінен жаңарады.",
                    )
                  : t(
                      "Kaspi создал платёж, но не прислал ссылку. Попробуйте ещё раз или выставьте счёт на номер.",
                      "Kaspi төлемді жасады, бірақ сілтеме жібермеді. Қайталап көріңіз немесе нөмірге шот жіберіңіз.",
                    )}
              </p>
              <Button
                type="button"
                className="mt-4 h-12 w-full text-base"
                disabled={busy !== null}
                onClick={() => void startCheckout("qr", order.planCode)}
              >
                {busy === "qr" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                {t(`Получить новую ссылку · ${formatKzt(order.amount)}`, `Жаңа сілтеме алу · ${formatKzt(order.amount)}`)}
              </Button>
            </>
          ) : (
            <>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                {t(`Оплатите ${formatKzt(order.amount)} в Kaspi`, `Kaspi арқылы ${formatKzt(order.amount)} төлеңіз`)}
              </h1>
              <a
                href={payUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("Открыть Kaspi и оплатить", "Kaspi-ді ашып, төлеу")}
                <ExternalLink className="size-4" aria-hidden />
              </a>
              <p className="mt-2 text-center text-sm text-muted-foreground" aria-live="off">
                {left != null
                  ? t(`Ссылка действует ещё ${formatLeft(left)}`, `Сілтеме тағы ${formatLeft(left)} жарамды`)
                  : t("Ссылка действует 5 минут", "Сілтеме 5 минут жарамды")}
              </p>

              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                aria-expanded={showQr}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium transition-colors hover:bg-secondary/70 sm:hidden"
              >
                <QrCode className="size-4" aria-hidden />
                {showQr ? t("Скрыть QR-код", "QR-кодты жасыру") : t("Показать QR-код", "QR-кодты көрсету")}
              </button>
              <div className={cn("mt-4 flex-col items-center gap-3 rounded-xl border border-border bg-secondary/40 p-4 sm:flex sm:flex-row sm:items-center sm:gap-5", showQr ? "flex" : "hidden")}>
                <div className="rounded-xl bg-white p-3 text-neutral-950 shadow-sm">
                  <QRCode value={payUrl} size={168} bgColor="#ffffff" fgColor="#0a0a0a" aria-label={t("QR-код для оплаты в Kaspi", "Kaspi арқылы төлеуге арналған QR-код")} />
                </div>
                <p className="text-center text-sm leading-relaxed text-muted-foreground sm:text-left">
                  {t(
                    "Платите с другого телефона? Откройте в приложении Kaspi сканер Kaspi QR и наведите камеру на код.",
                    "Басқа телефоннан төлейсіз бе? Kaspi қосымшасындағы Kaspi QR сканерін ашып, камераны кодқа бағыттаңыз.",
                  )}
                </p>
              </div>
            </>
          )
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {order.phoneMask
                ? t(
                    `Счёт на ${formatKzt(order.amount)} отправлен на ${nowrap(order.phoneMask)}`,
                    `${formatKzt(order.amount)} сомасына шот ${nowrap(order.phoneMask)} нөміріне жіберілді`,
                  )
                : t(`Счёт на ${formatKzt(order.amount)} отправлен в Kaspi`, `${formatKzt(order.amount)} сомасына шот Kaspi-ге жіберілді`)}
            </h1>
            <ol className="mt-4 space-y-2.5 text-sm leading-relaxed">
              {[
                t("Откройте приложение Kaspi.kz.", "Kaspi.kz қосымшасын ашыңыз."),
                t("Перейдите в «Платежи» → «Счета на оплату».", "«Төлемдер» → «Төлемге арналған шоттар» бөліміне өтіңіз."),
                t("Оплатите счёт от mytest — доступ откроется сразу.", "mytest шотын төлеңіз — қолжетімділік бірден ашылады."),
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          {t(
            "Ждём подтверждение от Kaspi — страница обновится сама.",
            "Kaspi растауын күтіп тұрмыз — бет өздігінен жаңарады.",
          )}
        </p>
        {checkedOnce && !checking && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "Оплату пока не видим. Если вы уже оплатили, подождите несколько секунд.",
              "Төлем әзірге көрінбейді. Төлеп қойсаңыз, бірнеше секунд күтіңіз.",
            )}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={checking} onClick={() => void checkNow()}>
            {checking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            {t("Проверить оплату", "Төлемді тексеру")}
          </Button>
          {!isQr && (
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              disabled={busy !== null}
              onClick={() => void startCheckout("qr", order.planCode)}
            >
              {busy === "qr" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ExternalLink className="size-4" aria-hidden />}
              {t("Счёт не пришёл — оплатить по ссылке", "Шот келмеді — сілтеме арқылы төлеу")}
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={backToChoice}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("Выбрать другой тариф или способ оплаты", "Басқа тарифті немесе төлем тәсілін таңдау")}
        </button>
      </section>
    )
  }

  // ---------- Выбор тарифа ----------
  return (
    <>
      <section>
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("Оплата подготовки к ЕНТ", "ҰБТ-ға дайындық төлемі")}
        </h1>
        {student && (
          <p className="mt-1 text-sm font-medium">
            {t("Ученик", "Оқушы")}: {student}
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t(
            "Вас попросили оплатить доступ к подготовке на mytest. Выберите тариф и оплатите со своего Kaspi — доступ откроется в аккаунте ученика сразу. Регистрироваться не нужно.",
            "Сізден mytest-тегі дайындыққа қолжетімділікті төлеу сұралды. Тарифті таңдап, өз Kaspi-іңізден төлеңіз — қолжетімділік оқушының аккаунтында бірден ашылады. Тіркелудің қажеті жоқ.",
          )}
        </p>
      </section>

      {info.access.active && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          {info.access.until
            ? t(
                `Платный доступ у ученика уже открыт — до ${formatDate(info.access.until, lang)}. Новый тариф начнёт действовать сразу после оплаты: дни к текущему не прибавляются.`,
                `Оқушының ақылы қолжетімділігі ашық — ${formatDate(info.access.until, lang)} дейін. Жаңа тариф төлемнен кейін бірден басталады: күндер қазіргісіне қосылмайды.`,
              )
            : t(
                "Платный доступ у ученика уже открыт. Новый тариф начнёт действовать сразу после оплаты: дни к текущему не прибавляются.",
                "Оқушының ақылы қолжетімділігі ашық. Жаңа тариф төлемнен кейін бірден басталады: күндер қазіргісіне қосылмайды.",
              )}
        </p>
      )}

      {noticeText && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100" role="status">
          {noticeText}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div role="radiogroup" aria-label={t("Тариф", "Тариф")} className="grid gap-2">
          {plans.map((p) => {
            const selected = p.id === planId
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setPlanId(p.id)
                  setError(null)
                }}
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  selected ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/60",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-foreground bg-foreground text-background" : "border-muted-foreground/40",
                  )}
                >
                  {selected && <Check className="size-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium">{p.name}</span>
                    {p.highlight && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-foreground">{p.highlight}</span>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {t(`${p.durationDays} ${ruDays(p.durationDays)} доступа`, `${p.durationDays} күн қолжетімділік`)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {p.originalPriceKzt != null && p.originalPriceKzt > p.priceKzt && (
                    <span className="block text-xs text-muted-foreground line-through tabular-nums">{formatKzt(p.originalPriceKzt)}</span>
                  )}
                  <span className="block font-semibold tabular-nums">{formatKzt(p.priceKzt)}</span>
                </span>
              </button>
            )
          })}
        </div>

        {plan && plan.features.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm">
            {plan.features.slice(0, 4).map((feature, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          className="mt-5 h-12 w-full text-base"
          disabled={!plan || busy !== null}
          onClick={() => void startCheckout("qr")}
        >
          {busy === "qr" && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {plan
            ? t(`Оплатить в Kaspi · ${formatKzt(plan.priceKzt)}`, `Kaspi арқылы төлеу · ${formatKzt(plan.priceKzt)}`)
            : t("Оплатить в Kaspi", "Kaspi арқылы төлеу")}
        </Button>
        <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
          {t(
            "Откроется оплата в приложении Kaspi. Разовый платёж, без автопродления.",
            "Kaspi қосымшасында төлем ашылады. Бір реттік төлем, автоматты түрде ұзартылмайды.",
          )}
        </p>

        {error && !invoiceOpen && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 border-t border-border pt-4">
          {invoiceOpen ? (
            <form
              className="flex flex-col gap-2"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                void startCheckout("invoice")
              }}
            >
              <label htmlFor="parent-pay-phone" className="text-sm font-medium">
                {t("Номер телефона, привязанный к Kaspi", "Kaspi-ге тіркелген телефон нөмірі")}
              </label>
              <input
                id="parent-pay-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 707 123 45 67"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value)
                  setError(null)
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby="parent-pay-phone-hint"
                className={cn(
                  "h-12 w-full rounded-lg border bg-background px-3 text-base outline-none transition-colors focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
                  error ? "border-red-500" : "border-border",
                )}
              />
              <p id="parent-pay-phone-hint" className="text-xs leading-relaxed text-muted-foreground">
                {t(
                  "Счёт придёт в приложение Kaspi: «Платежи» → «Счета на оплату». Номер нужен только для этого счёта.",
                  "Шот Kaspi қосымшасына келеді: «Төлемдер» → «Төлемге арналған шоттар». Нөмір тек осы шот үшін қажет.",
                )}
              </p>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" variant="outline" className="mt-1 h-11 w-full" disabled={!plan || busy !== null}>
                {busy === "invoice" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Smartphone className="size-4" aria-hidden />}
                {plan
                  ? t(`Отправить счёт на ${formatKzt(plan.priceKzt)}`, `${formatKzt(plan.priceKzt)} сомасына шот жіберу`)
                  : t("Отправить счёт", "Шот жіберу")}
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setInvoiceOpen(true)
                setError(null)
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
            >
              <Smartphone className="size-4" aria-hidden />
              {t("Или получить счёт на номер Kaspi", "Немесе Kaspi нөміріне шот алу")}
            </button>
          )}
        </div>
      </section>
    </>
  )
}
