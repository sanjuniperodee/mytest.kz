import { useState } from "react"
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import * as Linking from "expo-linking"
import { router } from "expo-router"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import type { AuthResponse } from "@/lib/api/types"
import { getTelegramBotLink, getTelegramBotUsername } from "@/lib/config"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "")
  let withCountry = digits
  if (digits.startsWith("8")) withCountry = "7" + digits.slice(1)
  if (!withCountry.startsWith("7")) withCountry = "7" + withCountry
  return "+" + withCountry.slice(0, 12)
}

function isPhoneNotLinkedError(err: unknown) {
  if (!(err instanceof ApiError)) return false
  return (
    err.message.includes("Номер не найден") ||
    err.message.includes("Пользователь не найден") ||
    err.message.includes("Откройте бота")
  )
}

export function PhoneLoginForm() {
  const { colors } = useAppTheme()
  const { setSession } = useAuth()
  const [step, setStep] = useState<"phone" | "code">("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const botUsername = getTelegramBotUsername()
  const botLink = getTelegramBotLink("mobile")

  const sendCode = async () => {
    const formatted = formatPhone(phone)
    if (formatted.length !== 12) {
      Alert.alert("Телефон", "Введите номер в формате +7XXXXXXXXXX")
      return
    }
    setLoading(true)
    try {
      await api("/auth/web/request-code", {
        method: "POST",
        auth: false,
        body: { phone: formatted },
      })
      setPhone(formatted)
      setStep("code")
      Alert.alert("Код", "Код отправлен в Telegram")
    } catch (err) {
      if (isPhoneNotLinkedError(err)) {
        Alert.alert(
          "Привязка",
          `Сначала привяжите номер в @${botUsername} в Telegram, затем вернитесь.`,
          [
            { text: "Открыть бота", onPress: () => void Linking.openURL(botLink) },
            { text: "OK" },
          ],
        )
        return
      }
      const msg = err instanceof ApiError ? err.message : "Не удалось отправить код"
      Alert.alert("Ошибка", msg)
    } finally {
      setLoading(false)
    }
  }

  const verify = async (otp: string) => {
    if (otp.length !== 6) return
    setLoading(true)
    try {
      const data = await api<AuthResponse>("/auth/web/verify-code", {
        method: "POST",
        auth: false,
        body: { phone, code: otp },
      })
      await setSession(data)
      router.replace("/dashboard")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Неверный код"
      Alert.alert("Ошибка", msg)
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  if (step === "code") {
    return (
      <View style={styles.block}>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Код отправлен в Telegram для {phone}
        </Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          placeholder="000000"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={(v) => {
            const d = v.replace(/\D/g, "").slice(0, 6)
            setCode(d)
            if (d.length === 6) void verify(d)
          }}
        />
        {loading ? <Spinner /> : null}
        <Pressable onPress={() => setStep("phone")}>
          <Text style={{ color: colors.accent, fontFamily: fonts.sansSemi }}>Изменить номер</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Телефон</Text>
      <TextInput
        style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
        placeholder="+7 700 000 00 00"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <Button onPress={() => void sendCode()} disabled={loading}>
        {loading ? "Отправка..." : "Получить код"}
      </Button>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Для входа по телефону сначала привяжите номер в @{botUsername}.
      </Text>
      <Pressable onPress={() => void Linking.openURL(botLink)}>
        <Text style={{ color: colors.accent, fontFamily: fonts.sansSemi }}>Открыть бота</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: 14 },
  label: { fontSize: 13, fontFamily: fonts.sansSemi },
  hint: { fontSize: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontFamily: fonts.sans,
  },
  note: { fontSize: 13, lineHeight: 18 },
})
