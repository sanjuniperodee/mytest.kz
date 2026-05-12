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
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

function PromoBar({ colors }: { colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return (
    <View style={[promoStyles.bar, { backgroundColor: colors.foreground }]}>
      <Text style={[promoStyles.text, { color: colors.background }]}>
        Пробный ЕНТ 2026 — на my-test.kz
      </Text>
    </View>
  )
}

const promoStyles = StyleSheet.create({
  bar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: {
    fontSize: 12,
    fontFamily: fonts.sansSemi,
  },
})

function TrustBar({ colors }: { colors: ReturnType<typeof useAppTheme>["colors"] }) {
  const items = [
    { value: "12 000+", label: "учеников" },
    { value: "+15 баллов", label: "средний прирост" },
    { value: "4.9", label: "рейтинг" },
  ]
  return (
    <View style={trustStyles.row}>
      {items.map((it, i) => (
        <View key={i} style={trustStyles.item}>
          <Text style={[trustStyles.value, { color: colors.foreground }]}>{it.value}</Text>
          <Text style={[trustStyles.label, { color: colors.mutedForeground }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  )
}

const trustStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  item: { alignItems: "center", gap: 4 },
  value: {
    fontSize: 20,
    fontFamily: fonts.sansBold,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.sans,
  },
})

function HowItWorks({ colors }: { colors: ReturnType<typeof useAppTheme>["colors"] }) {
  const steps = [
    { icon: "account-plus-outline" as const, title: "Регистрируйтесь", desc: "Бесплатно, за 30 секунд" },
    { icon: "book-open-page-variant-outline" as const, title: "Выбирайте предметы", desc: "ЕНТ, NUET и другие экзамены" },
    { icon: "chart-line" as const, title: "Сдавайте пробники", desc: "Разбор ошибок и аналитика" },
  ]
  return (
    <View style={howStyles.section}>
      <Text style={[howStyles.kicker, { color: colors.accent }]}>Как это работает</Text>
      <View style={{ gap: 16, marginTop: 16 }}>
        {steps.map((s, i) => (
          <View key={i} style={howStyles.step}>
            <View style={[howStyles.icon, { backgroundColor: colors.secondary }]}>
              <MaterialCommunityIcons name={s.icon} size={24} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[howStyles.title, { color: colors.foreground }]}>{s.title}</Text>
              <Text style={[howStyles.desc, { color: colors.mutedForeground }]}>{s.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const howStyles = StyleSheet.create({
  section: { paddingHorizontal: 20, paddingVertical: 32 },
  kicker: {
    fontSize: 12,
    fontFamily: fonts.sansSemi,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.sansSemi,
    marginBottom: 2,
  },
  desc: {
    fontSize: 13,
    fontFamily: fonts.sans,
    lineHeight: 18,
  },
})

function Features({ colors }: { colors: ReturnType<typeof useAppTheme>["colors"] }) {
  const items = [
    {
      icon: "target" as const,
      title: "Формат экзамена",
      desc: "Тесты точно как на реальном ЕНТ: те же предметы, лимиты времени и типы вопросов",
    },
    {
      icon: "lightbulb-on-outline" as const,
      title: "Разбор ошибок",
      desc: "После каждого пробника — объяснение каждого вопроса и работа над ошибками",
    },
    {
      icon: "chart-box-outline" as const,
      title: "Аналитика",
      desc: "Прогресс по предметам, динамика баллов и сравнение с другими участниками",
    },
  ]
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
      <Text style={[howStyles.kicker, { color: colors.accent, marginBottom: 16 }]}>
        Преимущества
      </Text>
      {items.map((f, i) => (
        <Card key={i} padded style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <MaterialCommunityIcons name={f.icon} size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[howStyles.title, { color: colors.foreground }]}>{f.title}</Text>
              <Text style={[howStyles.desc, { color: colors.mutedForeground, marginTop: 2 }]}>
                {f.desc}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </View>
  )
}

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
          <PromoBar colors={colors} />

          {/* Hero */}
          <View style={styles.hero}>
            <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>
                Подготовка к ЕНТ 2026
              </Text>
            </View>
            <Text style={[styles.h1, { color: colors.foreground }]}>
              Ваш пробный ЕНТ — в{" "}
              <Text style={{ fontFamily: fonts.serif, fontStyle: "italic" }}>mytest</Text>
            </Text>
            <Text style={[styles.p, { color: colors.mutedForeground }]}>
              Пробные тесты в формате экзамена, разбор ошибок и аналитика по предметам.
            </Text>

            {!isAuthenticated ? (
              <Button onPress={() => router.push("/login")}>Начать бесплатно</Button>
            ) : (
              <Button onPress={() => router.replace("/dashboard")}>Открыть кабинет</Button>
            )}

            <Pressable
              onPress={() => router.push("/login")}
              style={{ marginTop: 12, alignSelf: "center" }}
            >
              <Text style={{ color: colors.accent, fontFamily: fonts.sansSemi, fontSize: 14 }}>
                Уже есть аккаунт? Вход
              </Text>
            </Pressable>
          </View>

          <TrustBar colors={colors} />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <HowItWorks colors={colors} />

          <Features colors={colors} />

          {/* Lead form */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            <Card padded>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Оставить заявку
              </Text>
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
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[styles.footerMark, { backgroundColor: colors.foreground }]}>
                <MaterialCommunityIcons
                  name="star-four-points-small"
                  size={14}
                  color={colors.background}
                />
              </View>
              <Text style={[styles.footerBrand, { color: colors.foreground }]}>
                mytest
              </Text>
            </View>
            <Text style={[styles.footerCopy, { color: colors.mutedForeground }]}>
              my-test.kz
            </Text>
            <View style={styles.footerLinks}>
              <Text
                style={{ color: colors.accent, fontFamily: fonts.sansSemi }}
                onPress={() => router.push("/legal/privacy" as Href)}
              >
                Конфиденциальность
              </Text>
              <Text style={{ color: colors.mutedForeground }}>·</Text>
              <Text
                style={{ color: colors.accent, fontFamily: fonts.sansSemi }}
                onPress={() => router.push("/legal/terms" as Href)}
              >
                Условия
              </Text>
              <Text style={{ color: colors.mutedForeground }}>·</Text>
              <Text
                style={{ color: colors.accent, fontFamily: fonts.sansSemi }}
                onPress={() => router.push("/legal/support" as Href)}
              >
                Поддержка
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 40 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 16,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.sansSemi,
  },
  h1: {
    fontSize: 30,
    fontFamily: fonts.sansBold,
    marginBottom: 10,
    lineHeight: 36,
  },
  p: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  cardTitle: { fontSize: 17, fontFamily: fonts.sansBold, marginBottom: 12 },
  label: { fontSize: 12, fontFamily: fonts.sans, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fonts.sans,
  },
  area: { minHeight: 80, textAlignVertical: "top" },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  footerMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  footerBrand: {
    fontSize: 16,
    fontFamily: fonts.sansSemi,
    textTransform: "lowercase",
  },
  footerCopy: {
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  footerLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
})
