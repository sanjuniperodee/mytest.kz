import * as Google from "expo-auth-session/providers/google"
import * as WebBrowser from "expo-web-browser"
import { useEffect, useState } from "react"
import { Alert, Platform } from "react-native"
import { Button } from "@/components/ui/button"
import { useTr } from "@/lib/i18n/use-tr"

WebBrowser.maybeCompleteAuthSession()

const webClientId = () =>
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() || undefined
const androidClientId = () => process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined

/**
 * Google sign-in is offered on Android only, and only when its OAuth client is configured.
 * iOS deliberately has none: an app that offers a third-party login must also offer Sign in
 * with Apple (App Store guideline 4.8); phone and email are the app's own account systems.
 */
export function googleSignInAvailable(): boolean {
  return Platform.OS === "android" && Boolean(androidClientId())
}

function GoogleSignInInner({ onIdToken }: { onIdToken: (idToken: string) => void }) {
  const tr = useTr()
  const [busy, setBusy] = useState(false)
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webClientId(),
    androidClientId: androidClientId(),
  })

  useEffect(() => {
    if (response?.type !== "success") return
    const idToken =
      ("params" in response && (response.params as { id_token?: string }).id_token) || response.authentication?.idToken
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
          Alert.alert("Google", tr("Не удалось открыть окно входа", "Кіру терезесін ашу мүмкін болмады"))
        } finally {
          setBusy(false)
        }
      }}
    >
      {tr("Войти через Google", "Google арқылы кіру")}
    </Button>
  )
}

export function GoogleSignInButton({ onIdToken }: { onIdToken: (idToken: string) => void }) {
  if (!googleSignInAvailable()) return null
  return <GoogleSignInInner onIdToken={onIdToken} />
}
