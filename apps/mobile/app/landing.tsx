import { router, type Href } from "expo-router"
import { useState } from "react"
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

export default function LandingScreen() {
  const { colors, resolved } = useAppTheme()
  const { isAuthenticated } = useAuth()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  const submitLead = async () => {
    const n = name.trim()
    const p = phone.trim()
    if (n.length < 2) {
      Alert.alert("Имя", "Укажите имя (не короче 2 символов)")
      return
    }
    if (p.length < 5) {
      Alert.alert("Телефон", "Укажите телефон")
      return
    }
    setSending(true)
    try {
      await api("/leads", {
        method: "POST",
        auth: false,
        body: {
          name: n,
          phone: p,
          message: message.trim() || undefined,
          source: "mobile-app",
        },
      })
      Alert.alert("Спасибо", "Мы свяжемся с вами в ближайшее время")
      setName("")
      setPhone("")
      setMessage("")
    } catch {
      Alert.alert("Ошибка", "Не удалось отправить заявку. Попробуйте позже.")
    } finally {
      setSending(false)
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.kicker, { color: colors.accent }]}>Подготовка к ЕНТ 2026</Text>
          <Text style={[styles.h1, { color: colors.foreground }]}>
            Ваш пробный ЕНТ — в{" "}
            <Text style={{ fontFamily: fonts.serif, fontStyle: "italic" }}>mytest</Text>
          </Text>
          <Text style={[styles.p, { color: colors.mutedForeground }]}>
            Пробные тесты в формате экзамена, разбор ошибок и аналитика по предметам — с того же API,
            что и веб-версия.
          </Text>

          {!isAuthenticated ? (
            <Button onPress={() => router.push("/login")}>Войти</Button>
          ) : (
            <Button onPress={() => router.replace("/dashboard")}>Открыть кабинет</Button>
          )}

          <Card padded style={{ marginTop: 24 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Оставить заявку</Text>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Имя</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Айгерім"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Телефон</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+7 ..."
              keyboardType="phone-pad"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Комментарий</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Необязательно"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                styles.input,
                styles.area,
                { borderColor: colors.border, color: colors.foreground },
              ]}
            />
            <Button onPress={() => void submitLead()} disabled={sending}>
              {sending ? "Отправка..." : "Отправить"}
            </Button>
          </Card>

          <Pressable onPress={() => router.push("/login")} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.accent, fontFamily: fonts.sansSemi }}>
              Уже есть аккаунт? Вход
            </Text>
          </Pressable>

          <View style={styles.legalFooter}>
            <Text style={{ color: colors.accent }} onPress={() => router.push("/legal/privacy" as Href)}>
              Конфиденциальность
            </Text>
            <Text style={{ color: colors.mutedForeground }}> · </Text>
            <Text style={{ color: colors.accent }} onPress={() => router.push("/legal/terms" as Href)}>
              Условия
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  kicker: { fontSize: 12, fontFamily: fonts.sansSemi, marginBottom: 8 },
  h1: { fontSize: 28, fontFamily: fonts.sansBold, marginBottom: 10, lineHeight: 34 },
  p: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  cardTitle: { fontSize: 17, fontFamily: fonts.sansBold, marginBottom: 12 },
  label: { fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fonts.sans,
  },
  area: { minHeight: 80, textAlignVertical: "top" },
  legalFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 28,
  },
})
