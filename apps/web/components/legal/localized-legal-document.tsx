"use client"

import { useUiI18n } from "@/lib/i18n/ui"
import {
  buildPrivacyMarkdown,
  buildSupportMarkdown,
  buildTermsMarkdown,
  type LegalLocale,
} from "@/lib/legal-content"
import { MarkdownIshDocument } from "@/components/legal/markdown-ish-document"

type LegalDocumentKind = "privacy" | "terms" | "support"

export function LocalizedLegalDocument({
  kind,
  siteUrl,
}: {
  kind: LegalDocumentKind
  siteUrl: string
}) {
  const { locale } = useUiI18n()
  const legalLocale: LegalLocale = locale === "kk" ? "kk" : "ru"

  const source =
    kind === "privacy"
      ? buildPrivacyMarkdown(siteUrl, legalLocale)
      : kind === "terms"
        ? buildTermsMarkdown(siteUrl, legalLocale)
        : buildSupportMarkdown(siteUrl, legalLocale)

  return <MarkdownIshDocument key={legalLocale} source={source} />
}
