import * as Google from "expo-auth-session/providers/google"
import * as WebBrowser from "expo-web-browser"
import { useEffect, useState } from "react"
import { Alert, Platform, StyleSheet, Text } from "react-native"
import { Button } from "@/components/ui/button"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

WebBrowser.maybeCompleteAuthSession()

function googleNativeSetupHint(os: "ios" | "android"): string {
  if (os === "ios") {
    return (
      "В Google Cloud Console создайте OAuth-клиент типа «iOS», bundle ID как в app.json " +
      "(например com.sanjuniperodee.mobile), затем укажите EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID в .env. " +
      "Только «Веб-клиент» с приложением на телефоне не работает: Google блокирует custom scheme для типа WEB."
    )
  }
  return (
    "В Google Cloud Console создайте OAuth-клиент типа «Android» с package name из сборки и SHA‑1 " +
    "ключа подписи, затем EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID в .env."
  )
}

function GoogleSignInInner({
  webClientId,
  iosClientId,
  androidClientId,
  onIdToken,
}: {
  webClientId?: string
  iosClientId?: string
  androidClientId?: string
  onIdToken: (idToken: string) => void
}) {
  const [busy, setBusy] = useState(false)

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webClientId || undefined,
    iosClientId: iosClientId || undefined,
    androidClientId: androidClientId || undefined,
  })

  useEffect(() => {
    if (response?.type !== "success") return
    const idToken =
      ("params" in response && (response.params as { id_token?: string }).id_token) ||
      response.authentication?.idToken
    if (idToken) onIdToken(idToken)
  }, [response, onIdToken])

  return (
    <Button
      variant="outline"
      disabled={!request || busy}
      onPress={async () => {
        setBusy(true)
        try {
          await promptAsync()
        } catch {
          Alert.alert("Google", "Не удалось открыть окно входа")
        } finally {
          setBusy(false)
        }
      }}
    >
      Войти через Google
    </Button>
  )
}

export function GoogleSignInButton({ onIdToken }: { onIdToken: (idToken: string) => void }) {
  const { colors } = useAppTheme()
  const webClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim()
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim()
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim()

  const hasAnyClient = Boolean(webClientId || iosClientId || androidClientId)

  if (!hasAnyClient) {
    return (
      <Text style={[styles.disabled, { color: colors.mutedForeground }]}>
        Google: задайте EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID или EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID /
        ANDROID в .env
      </Text>
    )
  }

  if (Platform.OS === "web") {
    if (!webClientId) {
      return (
        <Text style={[styles.disabled, { color: colors.mutedForeground }]}>
          Google на web: нужен EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (тип «Веб-приложение»).
        </Text>
      )
    }
    return <GoogleSignInInner webClientId={webClientId} onIdToken={onIdToken} />
  }

  if (Platform.OS === "ios" && !iosClientId) {
    return <Text style={[styles.disabled, { color: colors.mutedForeground }]}>{googleNativeSetupHint("ios")}</Text>
  }

  if (Platform.OS === "android" && !androidClientId) {
    return (
      <Text style={[styles.disabled, { color: colors.mutedForeground }]}>
        {googleNativeSetupHint("android")}
      </Text>
    )
  }

  return (
    <GoogleSignInInner
      webClientId={webClientId || undefined}
      iosClientId={iosClientId || undefined}
      androidClientId={androidClientId || undefined}
      onIdToken={onIdToken}
    />
  )
}

const styles = StyleSheet.create({
  disabled: { fontSize: 13, fontFamily: fonts.sans },
})
