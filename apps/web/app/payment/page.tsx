import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CreditCard, ReceiptText, ShieldCheck, Smartphone } from "lucide-react"
import { LegalShell } from "@/components/legal/legal-shell"
import { PaymentBrandStrip } from "@/components/legal/payment-brand-strip"
import { LEGAL_SELLER } from "@/lib/legal-content"
import { getSiteUrl } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  return {
    title: "Оплата и возврат",
    description:
      "Способы оплаты mytest, порядок оплаты, контакты поддержки и реквизиты продавца.",
    alternates: { canonical: `${siteUrl}/payment` },
    openGraph: {
      title: "Оплата и возврат | mytest",
      url: `${siteUrl}/payment`,
      type: "website",
    },
  }
}

const steps = [
  {
    icon: <CreditCard className="size-5" />,
    title: "1. Выберите тариф и способ оплаты",
    text: "Все цены на сайте указаны в тенге (₸). Для покупки можно выбрать Freedom Pay с оплатой картой Visa / Mastercard или оплату через Kaspi.",
  },
  {
    icon: <Smartphone className="size-5" />,
    title: "2. Подтвердите платёж",
    text: "При оплате через Freedom Pay вы переходите на защищённую страницу платёжного сервиса. При оплате через Kaspi мы выставляем счёт на номер телефона или показываем Kaspi QR.",
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "3. Доступ включается автоматически",
    text: "После подтверждения оплаты система автоматически активирует подписку или выдаёт соответствующее количество попыток.",
  },
  {
    icon: <ReceiptText className="size-5" />,
    title: "4. Возврат и поддержка",
    text: "По вопросам оплаты, возврата и статуса подписки напишите в поддержку. Заявки рассматриваются по законодательству РК и правилам платёжного сервиса.",
  },
]

export default function PaymentPage() {
  return (
    <LegalShell title="Оплата и возврат">
      <div className="mt-8 flex flex-col gap-8">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Безопасная оплата
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Понятная оплата без сюрпризов
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              На mytest все тарифы и услуги отображаются в тенге. Перед оплатой вы всегда видите сумму,
              тариф, срок доступа и выбранный способ оплаты.
            </p>
            <PaymentBrandStrip className="pt-2" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {steps.map((step) => (
            <article key={step.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                {step.icon}
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-xl font-semibold tracking-tight">Реквизиты продавца</h3>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Наименование</dt>
                <dd className="mt-1 font-medium text-foreground">{LEGAL_SELLER.legalName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Юридический адрес</dt>
                <dd className="mt-1 font-medium text-foreground">{LEGAL_SELLER.address}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">БИН / ИИН</dt>
                <dd className="mt-1 font-medium text-foreground">{LEGAL_SELLER.bin}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Банк</dt>
                <dd className="mt-1 font-medium text-foreground">{LEGAL_SELLER.bank}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ИИК</dt>
                <dd className="mt-1 font-medium text-foreground">{LEGAL_SELLER.iik}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">БИК</dt>
                <dd className="mt-1 font-medium text-foreground">{LEGAL_SELLER.bik}</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-xl font-semibold tracking-tight">Контакты</h3>
            <div className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Email:</span> {LEGAL_SELLER.supportEmail}
              </p>
              <p>
                <span className="font-medium text-foreground">Телефон:</span> {LEGAL_SELLER.supportPhone}
              </p>
              <p>
                Для юридических условий и обработки данных смотрите{" "}
                <Link href="/terms" className="font-medium text-foreground underline underline-offset-4">
                  публичную оферту
                </Link>{" "}
                и{" "}
                <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
                  политику конфиденциальности
                </Link>
                .
              </p>
            </div>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Перейти к тарифам
              <ArrowRight className="size-4" />
            </Link>
          </article>
        </section>
      </div>
    </LegalShell>
  )
}
