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

  const chatNotice = kind !== "privacy" ? "" : legalLocale === "kk"
    ? "\n\n## Қауымдастық және чаттар\n\nЖарияланымдар мен оларға жауаптарды қауымдастық қатысушылары көреді. Жеке және топтық чаттарда хабарламалар, файлдар және дауыстық жазбалар серверде сақталады. Платформа әкімшілері модерация үшін барлық чаттарды және тіркемелерді қарай алады; мұндай қолжетімділік журналға жазылады. Чаттарда ұштан-ұшқа шифрлау қолданылмайды. Жойылған хабарламалар қатысушылардан жасырылады, ал олардың тіркемелері модерация үшін сақталуы мүмкін. Құпия құжаттарды жібермеңіз."
    : "\n\n## Сообщество и чаты\n\nПубликации и ответы видны участникам сообщества. В личных и групповых чатах сообщения, файлы и голосовые записи сохраняются на сервере. Администраторы платформы могут просматривать все чаты и вложения для модерации; такой доступ записывается в журнал. Сквозное шифрование в чатах не используется. Удалённые сообщения скрываются от участников, а их вложения могут сохраняться для модерации. Не отправляйте конфиденциальные документы."

  return <MarkdownIshDocument key={legalLocale} source={source + chatNotice} />
}
