import { Stack } from "expo-router"
import { LegalDocScreen } from "@/components/legal/LegalDocScreen"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { buildPrivacyMarkdown } from "@/lib/legal/content"

const SITE_URL = "https://my-test.kz"

export default function PrivacyScreen() {
  const { locale } = useUiLocale()
  const tr = useTr()
  return (
    <>
      <Stack.Screen options={{ title: tr("Конфиденциальность", "Құпиялылық") }} />
      <LegalDocScreen title={tr("Политика конфиденциальности", "Құпиялылық саясаты")} content={buildPrivacyMarkdown(SITE_URL, locale)} />
    </>
  )
}
