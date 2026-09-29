import { Stack } from "expo-router"
import { LegalDocScreen } from "@/components/legal/LegalDocScreen"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { buildSupportMarkdown } from "@/lib/legal/content"

const SITE_URL = "https://my-test.kz"

export default function SupportScreen() {
  const { locale } = useUiLocale()
  const tr = useTr()
  return (
    <>
      <Stack.Screen options={{ title: tr("Поддержка", "Қолдау") }} />
      <LegalDocScreen title={tr("Поддержка", "Қолдау")} content={buildSupportMarkdown(SITE_URL, locale)} />
    </>
  )
}
