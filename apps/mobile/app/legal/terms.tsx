import { Stack } from "expo-router"
import { LegalDocScreen } from "@/components/legal/LegalDocScreen"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { buildTermsMarkdown } from "@/lib/legal/content"

const SITE_URL = "https://my-test.kz"

export default function TermsScreen() {
  const { locale } = useUiLocale()
  const tr = useTr()
  return (
    <>
      <Stack.Screen options={{ title: tr("Условия", "Шарттар") }} />
      <LegalDocScreen title={tr("Условия использования", "Пайдалану шарттары")} content={buildTermsMarkdown(SITE_URL, locale)} />
    </>
  )
}
