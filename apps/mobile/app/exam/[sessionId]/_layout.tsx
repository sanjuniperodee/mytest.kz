import { Stack } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

export default function ExamSessionLayout() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  )
}
