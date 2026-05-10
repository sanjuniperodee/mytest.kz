import { Stack } from "expo-router"
import { LegalDocScreen } from "@/components/legal/LegalDocScreen"
import { PRIVACY_RU } from "@/lib/legal/documents"

export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Конфиденциальность" }} />
      <LegalDocScreen title="Политика конфиденциальности" content={PRIVACY_RU} />
    </>
  )
}
