import { MaterialCommunityIcons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { router } from "expo-router"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Screen } from "@/components/ui/screen"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/lib/api/auth-context"
import { useTr } from "@/lib/i18n/use-tr"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

const KEY = "mytest-community-rules-v1"

/**
 * User-generated content is only shown after the person accepts the community
 * rules (App Store guideline 1.2 / Google Play UGC policy).
 */
export function CommunityGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { colors } = useAppTheme()
  const tr = useTr()
  const [accepted, setAccepted] = useState<boolean | null>(null)
  const key = `${KEY}:${user?.id ?? "anon"}`

  useEffect(() => {
    let alive = true
    void AsyncStorage.getItem(key).then((v) => {
      if (alive) setAccepted(v === "1")
    })
    return () => {
      alive = false
    }
  }, [key])

  const accept = useCallback(() => {
    setAccepted(true)
    void AsyncStorage.setItem(key, "1")
  }, [key])

  if (accepted === null) return <Spinner fullScreen size="large" />
  if (accepted) return <>{children}</>

  const rules = [
    tr(
      "Уважайте других участников. Оскорбления, травля, угрозы, дискриминация и сцены насилия запрещены.",
      "Басқа қатысушыларды құрметтеңіз. Қорлау, қудалау, қорқыту, кемсіту және зорлық-зомбылық сахналарына тыйым салынады.",
    ),
    tr(
      "Не публикуйте контент 18+, спам, чужие личные данные и ответы на действующие экзамены.",
      "18+ контентті, спамды, өзгенің жеке деректерін және өтіп жатқан емтихан жауаптарын жарияламаңыз.",
    ),
    tr(
      "Вы можете пожаловаться на публикацию или сообщение и заблокировать пользователя. Жалобы рассматривает модерация, нарушители блокируются.",
      "Жарияланымға немесе хабарламаға шағымдана аласыз және пайдаланушыны бұғаттай аласыз. Шағымдарды модерация қарайды, тәртіп бұзушылар бұғатталады.",
    ),
    tr(
      "Модераторы платформы могут просматривать публикации, сообщения и вложения.",
      "Платформа модераторлары жарияланымдарды, хабарламаларды және тіркемелерді көре алады.",
    ),
  ]

  return (
    <Screen>
      <PageHeader
        title={tr("Правила сообщества", "Қауымдастық ережелері")}
        description={tr(
          "Прежде чем читать и писать, познакомьтесь с правилами.",
          "Оқу және жазу алдында ережелермен танысыңыз.",
        )}
      />
      <Card style={styles.card}>
        {rules.map((rule) => (
          <View key={rule} style={styles.rule}>
            <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.accent} style={styles.icon} />
            <Text style={[styles.text, { color: colors.foreground }]}>{rule}</Text>
          </View>
        ))}
        <Text style={[styles.small, { color: colors.mutedForeground }]}>
          {tr("Продолжая, вы соглашаетесь с ", "Жалғастыру арқылы сіз ")}
          <Text style={{ color: colors.accent }} onPress={() => router.push("/legal/terms" as never)}>
            {tr("Условиями использования", "Пайдалану шарттарымен")}
          </Text>
          {tr(".", " келісесіз.")}
        </Text>
        <Button onPress={accept}>{tr("Принимаю правила", "Ережелерді қабылдаймын")}</Button>
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 14 },
  rule: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  icon: { marginTop: 2 },
  text: { flex: 1, fontSize: 14, lineHeight: 21, fontFamily: fonts.sans },
  small: { fontSize: 12, lineHeight: 18 },
})
