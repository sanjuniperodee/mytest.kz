import type { Metadata } from "next"
import { LegalShell } from "@/components/legal/legal-shell"
import { LocalizedLegalDocument } from "@/components/legal/localized-legal-document"
import { getSiteUrl } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  return {
    title: "Условия использования",
    description: "Публичная оферта и правила использования платформы mytest и приложения My Test.",
    alternates: { canonical: `${siteUrl}/terms` },
    openGraph: {
      title: "Условия использования | mytest",
      url: `${siteUrl}/terms`,
      type: "website",
    },
  }
}

export default function TermsPage() {
  const siteUrl = getSiteUrl()
  return (
    <LegalShell title="Условия использования">
      <LocalizedLegalDocument kind="terms" siteUrl={siteUrl} />
    </LegalShell>
  )
}
