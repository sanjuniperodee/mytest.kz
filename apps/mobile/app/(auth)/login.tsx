import { Redirect, router, type Href } from "expo-router"
import { useEffect } from "react"
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"
import { EmailLoginForm } from "@/components/auth/EmailLoginForm"
import { PhoneLoginForm } from "@/components/auth/PhoneLoginForm"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import type { AuthResponse } from "@/lib/api/types"
import { useLocation } from "@/lib/location"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"
import { t, useUiLocale } from "@/lib/i18n/ui"

const googleIosConfigured = Boolean(
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim(),
)

export default function LoginScreen() {
  const { colors, resolved } = useAppTheme()
  const { locale: ui } = useUiLocale()
  const { isAuthenticated, isLoading, setSession } = useAuth()
  const { isInKZ } = useLocation()

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard")
  }, [isAuthenticated, isLoading])

  const onGoogleToken = async (credential: string) => {
    try {
      const data = await api<AuthResponse>("/auth/google", {
        method: "POST",
        auth: false,
        body: { credential },
      })
      await setSession(data)
      router.replace("/dashboard")
    } catch (err) {
      Alert.alert("Google", err instanceof ApiError ? err.message : t("loginGoogleFail", ui))
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.center, { flex: 1, backgroundColor: colors.background }]} edges={["top"]}>
        <Spinner size="large" />
      </SafeAreaView>
    )
  }

  if (isAuthenticated) return <Redirect href="/dashboard" />

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={[styles.title, { color: colors.foreground }]}>{t("login", ui)}</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {t("loginSubtitle", ui)}
        </Text>

        <Card style={{ marginTop: 20 }}>
          {isInKZ !== false ? (
            <>
              <Text style={[styles.section, { color: colors.foreground }]}>{t("loginPhone", ui)}</Text>
              <PhoneLoginForm />
              {googleIosConfigured && (
                <>
                  <View style={{ height: 20 }} />
                  <Text style={[styles.section, { color: colors.foreground }]}>{t("loginGoogle", ui)}</Text>
                  <GoogleSignInButton onIdToken={onGoogleToken} />
                </>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.section, { color: colors.foreground }]}>{t("loginEmail", ui)}</Text>
              <EmailLoginForm />
              <View style={{ height: 20 }} />
              <Text style={[styles.section, { color: colors.foreground }]}>{t("loginGoogle", ui)}</Text>
              <GoogleSignInButton onIdToken={onGoogleToken} />
            </>
          )}
        </Card>

        <Text style={[styles.footer, { color: colors.mutedForeground }]} onPress={() => router.replace("/landing")}>
          {t("loginBack", ui)}
        </Text>
        <View style={styles.legalRow}>
          <Text style={[styles.legalLink, { color: colors.accent }]} onPress={() => router.push("/legal/privacy" as Href)}>
            Политика конфиденциальности
          </Text>
          <Text style={[styles.legalDot, { color: colors.mutedForeground }]}> · </Text>
          <Text style={[styles.legalLink, { color: colors.accent }]} onPress={() => router.push("/legal/terms" as Href)}>
            Условия
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontFamily: fonts.sansBold },
  sub: { fontSize: 15, marginTop: 6 },
  section: { fontSize: 15, fontFamily: fonts.sansSemi, marginBottom: 10 },
  footer: { marginTop: 24, fontSize: 14 },
  legalRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  legalLink: { fontSize: 13 },
  legalDot: { fontSize: 13 },
})
