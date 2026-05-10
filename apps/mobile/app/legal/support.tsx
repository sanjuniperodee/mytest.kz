import { Stack } from "expo-router"
import { LegalDocScreen } from "@/components/legal/LegalDocScreen"
import { SUPPORT_RU } from "@/lib/legal/documents"

export default function SupportScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Поддержка" }} />
      <LegalDocScreen title="Поддержка" content={SUPPORT_RU} />
    </>
  )
}
