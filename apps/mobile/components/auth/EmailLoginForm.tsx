import { useState } from "react"
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { router } from "expo-router"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import type { AuthResponse } from "@/lib/api/types"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"
import { useTr } from "@/lib/i18n/use-tr"
import { t, useUiLocale } from "@/lib/i18n/ui"

export function EmailLoginForm() {
  const { colors } = useAppTheme()
  const { locale: ui } = useUiLocale()
  const tr = useTr()
  const { setSession } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes("@")) {
      Alert.alert(t("alertError", ui), t("emailInvalid", ui))
      return
    }
    if (password.length < 6) {
      Alert.alert(t("alertError", ui), t("passwordShort", ui))
      return
    }

    setLoading(true)
    try {
      // Registration by email is closed on the server; this form signs in existing accounts.
      const data = await api<AuthResponse>("/auth/login", {
        method: "POST",
        auth: false,
        body: { email: trimmed, password },
      })
      await setSession(data)
      router.replace("/dashboard")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("emailAuthFail", ui)
      Alert.alert(t("alertError", ui), msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.block}>
      <TextInput
        style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
        placeholder="email@example.com"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
        placeholder={t("passwordPlaceholder", ui)}
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button onPress={() => void submit()} disabled={loading}>
        {loading ? t("loading", ui) : t("loginBtn", ui)}
      </Button>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        {tr(
          "Вход по email — для уже созданных аккаунтов. Новый аккаунт создаётся по телефону.",
          "Email арқылы кіру — бұрыннан бар аккаунттар үшін. Жаңа аккаунт телефон арқылы құрылады.",
        )}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  note: { fontSize: 13, lineHeight: 18 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: fonts.sans,
  },
})
