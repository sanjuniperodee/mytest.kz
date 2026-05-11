import type { Metadata } from "next"
import Link from "next/link"
import { LegalShell } from "@/components/legal/legal-shell"
import { Button } from "@/components/ui/button"
import { getSiteUrl } from "@/lib/site"

const playStoreUrl =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() || "https://play.google.com/store/apps/details?id=com.sanjuniperodee.mobile"
const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || ""

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  return {
    title: "Мобильное приложение",
    description: "My Test — приложение для пробных ЕНТ и кабинета mytest на телефоне.",
    alternates: { canonical: `${siteUrl}/mobile` },
    openGraph: {
      title: "Мобильное приложение My Test | mytest",
      url: `${siteUrl}/mobile`,
      type: "website",
    },
  }
}

export default function MobilePage() {
  const siteUrl = getSiteUrl()

  return (
    <LegalShell title="Мобильное приложение My Test">
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground md:text-base md:leading-7">
        Готовьтесь к ЕНТ с тем же аккаунтом, что и на сайте: пробные сессии с таймером, условия с формулами,
        статистика и разбор ошибок — в удобном мобильном интерфейсе.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild className="rounded-full px-8" size="lg">
          <a href={playStoreUrl} target="_blank" rel="noopener noreferrer">
            Google Play
          </a>
        </Button>
        {appStoreUrl ? (
          <Button asChild variant="outline" className="rounded-full px-8" size="lg">
            <a href={appStoreUrl} target="_blank" rel="noopener noreferrer">
              App Store
            </a>
          </Button>
        ) : (
          <p className="flex items-center text-sm text-muted-foreground sm:pl-2">
            Версия для iOS появится в App Store — следите за обновлениями.
          </p>
        )}
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        Документы:{" "}
        <Link href="/privacy" className="font-medium text-foreground underline-offset-4 hover:underline">
          Политика конфиденциальности
        </Link>
        {" · "}
        <Link href="/terms" className="font-medium text-foreground underline-offset-4 hover:underline">
          Условия
        </Link>
        {" · "}
        <Link href="/support" className="font-medium text-foreground underline-offset-4 hover:underline">
          Поддержка
        </Link>
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Маркетинговый URL для консолей магазинов:{" "}
        <span className="select-all font-mono text-foreground">{siteUrl}/mobile</span>
      </p>
    </LegalShell>
  )
}
