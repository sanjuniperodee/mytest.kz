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
import { useTr } from "@/lib/i18n/use-tr"

/**
 * Sign-in for accounts made through the closed email signup. Passwords no longer work: the server
 * mails a one-time code to the address and the code is the login. An address without an account
 * gets no mail, and the answer does not say which case it is.
 */
export function EmailLoginForm() {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { setSession } = useAuth()
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes("@")) {
      Alert.alert(tr("Ошибка", "Қате"), tr("Введите корректный email", "Дұрыс email енгізіңіз"))
      return
    }

    setLoading(true)
    try {
      await api("/auth/email/request-code", {
        method: "POST",
        auth: false,
        body: { email: trimmed },
      })
      setEmail(trimmed)
      setCode("")
      setStep("code")
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : tr("Не удалось отправить код", "Кодты жіберу мүмкін болмады")
      Alert.alert(tr("Ошибка", "Қате"), msg)
    } finally {
      setLoading(false)
    }
  }

  const verify = async (otp: string) => {
    if (otp.length !== 6) return
    setLoading(true)
    try {
      const data = await api<AuthResponse>("/auth/email/verify-code", {
        method: "POST",
        auth: false,
        body: { email, code: otp },
      })
      await setSession(data)
      router.replace("/dashboard")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : tr("Неверный код", "Код қате")
      Alert.alert(tr("Ошибка", "Қате"), msg)
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  if (step === "code") {
    return (
      <View style={styles.block}>
        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          {tr(
            `Если аккаунт с адресом ${email} есть, мы отправили на него код. Проверьте папку «Спам».`,
            `${email} мекенжайымен аккаунт болса, оған код жібердік. «Спам» қалтасын тексеріңіз.`,
          )}
        </Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          placeholder="000000"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, "").slice(0, 6)
            setCode(digits)
            if (digits.length === 6) void verify(digits)
          }}
        />
        {loading ? <Spinner /> : null}
        <Pressable
          onPress={() => {
            setStep("email")
            setCode("")
          }}
        >
          <Text style={{ color: colors.accent, fontFamily: fonts.sansSemi }}>
            {tr("Изменить адрес или запросить код ещё раз", "Мекенжайды өзгерту немесе кодты қайта сұрау")}
          </Text>
        </Pressable>
      </View>
    )
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
      <Button onPress={() => void sendCode()} disabled={loading}>
        {loading ? tr("Загрузка…", "Жүктелуде…") : tr("Получить код на почту", "Кодты поштаға алу")}
      </Button>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        {tr(
          "Вход по email — для уже созданных аккаунтов: код придёт на почту, пароль больше не нужен. Новый аккаунт создаётся по телефону.",
          "Email арқылы кіру — бұрыннан бар аккаунттар үшін: код поштаға келеді, құпия сөз қажет емес. Жаңа аккаунт телефон арқылы құрылады.",
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
