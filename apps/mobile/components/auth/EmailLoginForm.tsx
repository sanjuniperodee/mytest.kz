import { useState } from "react"
import {
  Alert,
  Pressable,
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
import { t, useUiLocale } from "@/lib/i18n/ui"

export function EmailLoginForm() {
  const { colors } = useAppTheme()
  const { locale: ui } = useUiLocale()
  const { setSession } = useAuth()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
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
      const path = mode === "register" ? "/auth/register" : "/auth/login"
      const body =
        mode === "register"
          ? { email: trimmed, password, firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined }
          : { email: trimmed, password }

      const data = await api<AuthResponse>(path, {
        method: "POST",
        auth: false,
        body,
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
      {mode === "register" && (
        <>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            placeholder={t("emailFirstName", ui)}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            placeholder={t("emailLastName", ui)}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            value={lastName}
            onChangeText={setLastName}
          />
        </>
      )}
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
        {loading
          ? t("loading", ui)
          : mode === "register"
            ? t("registerBtn", ui)
            : t("loginBtn", ui)}
      </Button>
      <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
        <Text style={{ color: colors.accent, fontFamily: fonts.sansSemi, textAlign: "center" }}>
          {mode === "login" ? t("noAccount", ui) : t("haveAccount", ui)}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: fonts.sans,
  },
})
