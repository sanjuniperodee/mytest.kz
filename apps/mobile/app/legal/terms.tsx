import { Stack } from "expo-router"
import { LegalDocScreen } from "@/components/legal/LegalDocScreen"
import { TERMS_RU } from "@/lib/legal/documents"

export default function TermsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Условия" }} />
      <LegalDocScreen title="Условия использования" content={TERMS_RU} />
    </>
  )
}
