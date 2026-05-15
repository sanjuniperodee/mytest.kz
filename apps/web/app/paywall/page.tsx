import Link from "next/link"
import { CheckCircle2, CreditCard, XCircle } from "lucide-react"
import { LegalShell } from "@/components/legal/legal-shell"

type SearchParamsShape = {
  payment?: string
}

function isSuccess(state?: string) {
  return state === "success" || state === "paid" || state === "ok"
}

export default async function PaywallPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsShape> | SearchParamsShape
}) {
  const params = searchParams && typeof (searchParams as Promise<SearchParamsShape>).then === "function"
    ? await (searchParams as Promise<SearchParamsShape>)
    : ((searchParams as SearchParamsShape | undefined) ?? {})

  const success = isSuccess(params.payment)

  return (
    <LegalShell title={success ? "Оплата подтверждена" : "Платёж не завершён"}>
      <div className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4">
          <div
            className={[
              "inline-flex size-14 items-center justify-center rounded-2xl",
              success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
            ].join(" ")}
          >
            {success ? <CheckCircle2 className="size-7" /> : <XCircle className="size-7" />}
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {success ? "Подписка скоро появится в кабинете" : "Оплата не была подтверждена"}
          </h2>

          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {success
              ? "Если платёж уже прошёл, откройте тарифы или кабинет: статус обновится автоматически. Обычно это занимает совсем немного времени."
              : "Вы можете вернуться к тарифам и попробовать снова: выбрать Freedom Pay или Kaspi и завершить оплату удобным способом."}
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              <CreditCard className="size-4" />
              Открыть тарифы
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              В кабинет
            </Link>
          </div>
        </div>
      </div>
    </LegalShell>
  )
}
