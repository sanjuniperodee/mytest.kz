import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useState } from "react"
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { api, ApiError } from "@/lib/api/client"
import type { QuestionAppeal, QuestionAppealReason, QuestionAppealStatus } from "@/lib/api/types"
import { useTr } from "@/lib/i18n/use-tr"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

export function useAppealCopy() {
  const tr = useTr()
  const reasons: { value: QuestionAppealReason; label: string; hint: string }[] = [
    { value: "incorrect_answer", label: tr("Неверный ответ", "Дұрыс емес жауап"), hint: tr("Ключ ответа не совпадает с условием или отмечен неправильно.", "Жауап кілті шартқа сәйкес келмейді немесе қате белгіленген.") },
    { value: "ambiguous_wording", label: tr("Неясная формулировка", "Түсініксіз тұжырым"), hint: tr("Условие или варианты читаются двусмысленно.", "Шарт немесе нұсқалар екіұшты оқылады.") },
    { value: "outdated_content", label: tr("Устаревший контент", "Ескірген контент"), hint: tr("В вопросе устаревший факт, цифра или формулировка.", "Сұрақта ескірген дерек, сан немесе тұжырым бар.") },
    { value: "broken_media", label: tr("Проблема с медиа", "Медиа мәселесі"), hint: tr("Картинка, схема или часть контента отображается некорректно.", "Сурет, сызба немесе контенттің бір бөлігі дұрыс көрсетілмейді.") },
    { value: "other", label: tr("Другое", "Басқа"), hint: tr("Любая другая проблема, которую важно описать вручную.", "Қолмен сипаттау маңызды кез келген басқа мәселе.") },
  ]
  const status = (s: QuestionAppealStatus): { label: string; color: string } =>
    s === "resolved"
      ? { label: tr("Решена", "Шешілді"), color: "#059669" }
      : s === "rejected"
        ? { label: tr("Отклонена", "Қабылданбады"), color: "#E11D48" }
        : s === "under_review"
          ? { label: tr("На проверке", "Тексерілуде"), color: "#D97706" }
          : { label: tr("Отправлена", "Жіберілді"), color: "#0284C7" }
  return { reasons, status }
}

export const upsertAppeal = (appeals: QuestionAppeal[], next: QuestionAppeal) => {
  const i = appeals.findIndex((a) => a.questionId === next.questionId)
  if (i === -1) return [next, ...appeals]
  const copy = [...appeals]
  copy[i] = next
  return copy
}

/** "Found a mistake in the question?" — an appeal that keeps the attempt going. */
export function QuestionAppealButton({
  sessionId,
  questionId,
  appeal,
  onSaved,
}: {
  sessionId: string
  questionId: string
  appeal: QuestionAppeal | null
  onSaved: (appeal: QuestionAppeal) => void
}) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { reasons, status } = useAppealCopy()
  const meta = appeal ? status(appeal.status) : null
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<QuestionAppealReason>("incorrect_answer")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const show = () => {
    setReason(appeal?.reason || "incorrect_answer")
    setMessage(appeal?.message || "")
    setOpen(true)
  }
  const editable = !appeal || appeal.status === "pending"

  const submit = async () => {
    const text = message.trim()
    if (text.length < 12) {
      Alert.alert(tr("Опишите проблему чуть подробнее", "Мәселені толығырақ сипаттаңыз"))
      return
    }
    setBusy(true)
    try {
      const saved = await api<QuestionAppeal>(`/tests/sessions/${sessionId}/questions/${questionId}/appeal`, { method: "POST", body: { reason, message: text } })
      onSaved(saved)
      setOpen(false)
    } catch (e) {
      Alert.alert(tr("Ошибка", "Қате"), e instanceof ApiError && e.message ? e.message : tr("Не удалось отправить апелляцию", "Апелляцияны жіберу мүмкін болмады"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Pressable accessibilityRole="button" onPress={show} style={[styles.trigger, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <MaterialCommunityIcons name="flag-outline" size={15} color={colors.foreground} />
        <Text style={[styles.triggerText, { color: colors.foreground }]}>{appeal ? tr("Апелляция", "Апелляция") : tr("Ошибка в вопросе?", "Сұрақта қате бар ма?")}</Text>
        {meta ? <Text style={[styles.badge, { backgroundColor: meta.color }]}>{meta.label}</Text> : null}
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={tr("Апелляция по текущему вопросу", "Ағымдағы сұрақ бойынша апелляция")}
        description={tr("Можно отправить апелляцию прямо во время экзамена и продолжить попытку без потери времени.", "Апелляцияны емтихан кезінде-ақ жіберіп, уақыт жоғалтпай жалғастыруға болады.")}
      >
        <View style={styles.form}>
          {appeal?.adminNote ? (
            <Text style={[styles.note, { color: colors.mutedForeground, backgroundColor: colors.secondary }]}>
              {tr("Комментарий команды", "Команда пікірі")}: {appeal.adminNote}
            </Text>
          ) : null}
          {reasons.map((r) => (
            <Pressable
              key={r.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: reason === r.value, disabled: !editable }}
              disabled={!editable}
              onPress={() => setReason(r.value)}
              style={[styles.reason, { borderColor: reason === r.value ? colors.foreground : colors.border, opacity: editable ? 1 : 0.6 }]}
            >
              <Text style={[styles.reasonTitle, { color: colors.foreground }]}>{r.label}</Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>{r.hint}</Text>
            </Pressable>
          ))}
          <TextInput
            value={message}
            onChangeText={setMessage}
            editable={editable && !busy}
            multiline
            maxLength={2000}
            placeholder={tr("Опишите, что не так (не меньше 12 символов)", "Не дұрыс екенін сипаттаңыз (кемінде 12 таңба)")}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />
          <View style={styles.footer}>
            <Button variant="outline" onPress={() => setOpen(false)}>
              {tr("Закрыть", "Жабу")}
            </Button>
            {editable ? (
              <Button disabled={busy} onPress={() => void submit()}>
                {appeal ? tr("Обновить", "Жаңарту") : tr("Отправить", "Жіберу")}
              </Button>
            ) : null}
          </View>
        </View>
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 40, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12 },
  triggerText: { fontSize: 13, fontFamily: fonts.sansSemi },
  badge: { color: "#fff", fontSize: 10, fontFamily: fonts.sansSemi, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, overflow: "hidden" },
  form: { gap: 10, paddingTop: 12 },
  note: { fontSize: 13, lineHeight: 19, borderRadius: 10, padding: 10 },
  reason: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 2 },
  reasonTitle: { fontSize: 14, fontFamily: fonts.sansSemi },
  hint: { fontSize: 12, lineHeight: 17 },
  input: { minHeight: 96, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 14, textAlignVertical: "top", fontFamily: fonts.sans },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
})
