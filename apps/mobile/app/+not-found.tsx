import { Link, Stack } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAppTheme } from "@/lib/theme/provider"

export default function NotFoundScreen() {
  const { colors } = useAppTheme()
  return (
    <>
      <Stack.Screen options={{ title: "Страница не найдена" }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Экран не найден</Text>
          <Link href="/" asChild>
            <Pressable>
              <Text style={{ color: colors.accent, fontSize: 16 }}>На главную</Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
})
