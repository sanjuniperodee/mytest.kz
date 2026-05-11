import type { Metadata } from "next"
import { LegalShell } from "@/components/legal/legal-shell"
import { MarkdownIshDocument } from "@/components/legal/markdown-ish-document"
import { buildPrivacyMarkdown } from "@/lib/legal-content"
import { getSiteUrl } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  return {
    title: "Политика конфиденциальности",
    description:
      "Как mytest обрабатывает персональные данные на сайте и в приложении My Test для подготовки к ЕНТ.",
    alternates: { canonical: `${siteUrl}/privacy` },
    openGraph: {
      title: "Политика конфиденциальности | mytest",
      url: `${siteUrl}/privacy`,
      type: "website",
    },
  }
}

export default function PrivacyPage() {
  const siteUrl = getSiteUrl()
  return (
    <LegalShell title="Политика конфиденциальности">
      <MarkdownIshDocument source={buildPrivacyMarkdown(siteUrl)} />
    </LegalShell>
  )
}
