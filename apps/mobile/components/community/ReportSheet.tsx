import { useState } from "react"
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { api } from "@/lib/api/client"
import { useTr } from "@/lib/i18n/use-tr"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"
import { errorMessage } from "./shared"

/** Report a post or a chat message to the moderators. */
export function ReportSheet({
  visible,
  onClose,
  path,
}: {
  visible: boolean
  onClose: () => void
  /** API path that accepts POST { reason }. */
  path: string
}) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const reasons = [
    tr("Спам или реклама", "Спам немесе жарнама"),
    tr("Оскорбления или травля", "Қорлау немесе қудалау"),
    tr("Неприемлемый контент (18+, насилие)", "Орынсыз контент (18+, зорлық)"),
    tr("Личные данные или ответы на экзамен", "Жеке деректер немесе емтихан жауаптары"),
    tr("Другое", "Басқа"),
  ]
  const [choice, setChoice] = useState(0)
  const [details, setDetails] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const reason = [reasons[choice], details.trim()].filter(Boolean).join(": ").slice(0, 500)
      await api(path, { method: "POST", body: { reason } })
      setDetails("")
      setChoice(0)
      onClose()
      Alert.alert(tr("Спасибо", "Рақмет"), tr("Жалоба отправлена. Модераторы её рассмотрят.", "Шағым жіберілді. Модераторлар қарайды."))
    } catch (e) {
      Alert.alert(tr("Ошибка", "Қате"), errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={tr("Пожаловаться", "Шағымдану")}
      description={tr("Что не так? Жалоба анонимна для автора.", "Не дұрыс емес? Шағым автор үшін жасырын.")}
    >
      <View style={styles.body}>
        {reasons.map((label, i) => (
          <Pressable
            key={label}
            accessibilityRole="radio"
            accessibilityState={{ selected: choice === i }}
            onPress={() => setChoice(i)}
            style={[styles.row, { borderColor: choice === i ? colors.foreground : colors.border }]}
          >
            <View style={[styles.radio, { borderColor: colors.foreground }]}>
              {choice === i ? <View style={[styles.dot, { backgroundColor: colors.foreground }]} /> : null}
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
          </Pressable>
        ))}
        <TextInput
          value={details}
          onChangeText={setDetails}
          maxLength={300}
          multiline
          placeholder={tr("Подробности (необязательно)", "Толығырақ (міндетті емес)")}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
        />
        <Button onPress={() => void submit()} disabled={busy}>
          {tr("Отправить жалобу", "Шағым жіберу")}
        </Button>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: 10, paddingTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1, fontSize: 14, fontFamily: fonts.sans },
  input: { minHeight: 76, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 14, textAlignVertical: "top", fontFamily: fonts.sans },
})
