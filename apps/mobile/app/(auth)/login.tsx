import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Redirect, router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect, useState } from "react"
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { EmailLoginForm } from "@/components/auth/EmailLoginForm"
import { GoogleSignInButton, googleSignInAvailable } from "@/components/auth/GoogleSignInButton"
import { PhoneLoginForm } from "@/components/auth/PhoneLoginForm"
import { Card } from "@/components/ui/card"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/lib/api/auth-context"
import { api, ApiError } from "@/lib/api/client"
import type { AuthResponse } from "@/lib/api/types"
import { useTr } from "@/lib/i18n/use-tr"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

type Method = "phone" | "email" | "google"

export default function LoginScreen() {
  const { colors, resolved } = useAppTheme()
  const tr = useTr()
  const { isAuthenticated, isLoading, setSession } = useAuth()
  const [method, setMethod] = useState<Method>("phone")

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard")
  }, [isAuthenticated, isLoading])

  const onGoogleToken = async (credential: string) => {
    try {
      const data = await api<AuthResponse>("/auth/google", { method: "POST", auth: false, body: { credential } })
      await setSession(data)
      router.replace("/dashboard")
    } catch (err) {
      Alert.alert("Google", err instanceof ApiError ? err.message : tr("Не удалось войти", "Кіру мүмкін болмады"))
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]} edges={["top"]}>
        <Spinner size="large" />
      </SafeAreaView>
    )
  }
  if (isAuthenticated) return <Redirect href="/dashboard" />

  const methods: { value: Method; label: string }[] = [
    { value: "phone", label: tr("Телефон", "Телефон") },
    { value: "email", label: "Email" },
    ...(googleSignInAvailable() ? [{ value: "google" as const, label: "Google" }] : []),
  ]

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <View style={[styles.chip, { backgroundColor: `${colors.accent}14`, borderColor: `${colors.accent}33` }]}>
            <MaterialCommunityIcons name="gift-outline" size={14} color={colors.accent} />
            <Text style={[styles.chipText, { color: colors.accent }]}>
              {tr("1 полный пробный бесплатно · без карты", "1 толық сынақ тегін · картасыз")}
            </Text>
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
            {tr("Войти или создать аккаунт", "Кіру немесе аккаунт құру")}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {tr(
              "Тот же аккаунт, что на сайте my-test.kz. Выбери удобный способ — новый аккаунт создастся автоматически.",
              "my-test.kz сайтындағыдай аккаунт. Ыңғайлы тәсілді таңда — жаңа аккаунт автоматты түрде құрылады.",
            )}
          </Text>

          <Card style={styles.card}>
            {methods.length > 1 ? <SegmentedTabs value={method} onChange={setMethod} items={methods} /> : null}
            {method === "phone" ? <PhoneLoginForm /> : null}
            {method === "email" ? <EmailLoginForm /> : null}
            {method === "google" ? <GoogleSignInButton onIdToken={onGoogleToken} /> : null}
          </Card>

          <Text style={[styles.footer, { color: colors.mutedForeground }]} onPress={() => router.replace("/landing")}>
            {tr("Назад", "Артқа")}
          </Text>
          <View style={styles.legalRow}>
            <Text style={[styles.legalLink, { color: colors.accent }]} onPress={() => router.push("/legal/privacy" as never)}>
              {tr("Политика конфиденциальности", "Құпиялылық саясаты")}
            </Text>
            <Text style={[styles.legalLink, { color: colors.mutedForeground }]}> · </Text>
            <Text style={[styles.legalLink, { color: colors.accent }]} onPress={() => router.push("/legal/terms" as never)}>
              {tr("Условия", "Шарттар")}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pad: { padding: 20, gap: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontFamily: fonts.sansSemi },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.5, fontFamily: fonts.sansBold },
  sub: { fontSize: 15, lineHeight: 22 },
  card: { marginTop: 8, gap: 16 },
  footer: { marginTop: 16, fontSize: 14, textAlign: "center" },
  legalRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  legalLink: { fontSize: 13 },
})
