import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { SelectSheet } from "@/components/ui/select-sheet"
import { Sheet } from "@/components/ui/sheet"
import { api } from "@/lib/api/client"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

type Feedback = { submittedAt: string | null; skippedAt: string | null } | null

// Asked at most once per app session per attempt, like the site's session-scoped prompt.
const promptedSessions = new Set<string>()

/** Short, optional survey after a mock exam; opens once by itself and can be reopened by hand. */
export function TestFeedback({ sessionId }: { sessionId: string }) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { locale } = useUiLocale()
  const endpoint = `/tests/sessions/${sessionId}/feedback`
  const { data, error, isLoading, mutate } = useSWR<Feedback>(endpoint, (path: string) => api<Feedback>(path), { revalidateOnFocus: false })
  const [rating, setRating] = useState(0)
  const [intent, setIntent] = useState("")
  const [blocker, setBlocker] = useState("")
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState("")
  const [open, setOpen] = useState(false)
  const shown = useRef(false)
  const closed = Boolean(data?.submittedAt || data?.skippedAt)

  useEffect(() => {
    if (isLoading || error || closed || promptedSessions.has(sessionId)) return
    const timer = setTimeout(() => {
      promptedSessions.add(sessionId)
      setOpen(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [sessionId, isLoading, error, closed])

  useEffect(() => {
    if (!open || shown.current) return
    shown.current = true
    void api(`${endpoint}/shown`, { method: "POST" }).catch(() => {
      shown.current = false
    })
  }, [open, endpoint])

  const dismiss = () => {
    setOpen(false)
    // Closing must never be blocked by an unavailable API.
    if (!busy && !data?.submittedAt) {
      void api(`${endpoint}/skip`, { method: "POST" })
        .then(() => mutate())
        .catch(() => {})
    }
  }

  const save = async () => {
    if (busy || !rating || !intent || !blocker) return
    setBusy(true)
    setFailure("")
    try {
      const result = await api<Feedback>(endpoint, {
        method: "PUT",
        body: { rating, intent, blocker, comment: comment.trim(), locale: locale === "kk" ? "kk" : "ru" },
      })
      await mutate(result, { revalidate: false })
      setOpen(false)
    } catch {
      setFailure(tr("Не удалось отправить. Попробуйте ещё раз — текст сохранён в форме.", "Жіберілмеді. Қайта көріңіз — мәтін нысанда сақталды."))
    } finally {
      setBusy(false)
    }
  }

  if (isLoading || error) return null
  if (data?.submittedAt) {
    return (
      <Text accessibilityRole="text" style={[styles.thanks, { color: colors.mutedForeground }]}>
        {tr("Спасибо за отзыв! Он поможет улучшить пробный.", "Пікіріңізге рақмет! Ол сынақты жақсартуға көмектеседі.")}
      </Text>
    )
  }

  const intents: [string, string, string][] = [
    ["yes", "Да", "Иә"],
    ["maybe", "Пока не решил(а)", "Әлі шешкен жоқпын"],
    ["no", "Нет", "Жоқ"],
    ["already_paid", "Уже купил(а)", "Сатып алдым"],
  ]
  const blockers: [string, string, string][] = [
    ["none", "Ничего", "Ештеңе"],
    ["price", "Цена", "Бағасы"],
    ["value", "Не вижу пользы платного доступа", "Ақылы нұсқаның пайдасы түсініксіз"],
    ["payment", "Не получается оплатить", "Төлем жасай алмаймын"],
    ["trust", "Не уверен(а) в качестве", "Сапасына сенімді емеспін"],
    ["later", "Сейчас не нужно / нет времени", "Қазір қажет емес / уақыт жоқ"],
    ["other", "Другое", "Басқа"],
  ]

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onPress={() => setOpen(true)}
        icon={(c) => <MaterialCommunityIcons name="message-outline" size={16} color={c} />}
      >
        {tr("Оценить пробный", "Сынақты бағалау")}
      </Button>
      <Sheet
        visible={open}
        onClose={dismiss}
        title={tr("Как вам пробный?", "Сынақ қалай өтті?")}
        description={tr(
          "Оцените пользу и подскажите, что улучшить. Это необязательно — к разбору можно вернуться в любой момент.",
          "Пайдасын бағалап, нені жақсартуға болатынын айтыңыз. Бұл міндетті емес — талдауға кез келген уақытта орала аласыз.",
        )}
      >
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.foreground }]}>{tr("Насколько полезным был пробный?", "Сынақ қаншалықты пайдалы болды?")}</Text>
          <View style={styles.rating} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: rating === value }}
                onPress={() => setRating(value)}
                style={[styles.star, { borderColor: colors.border, backgroundColor: rating === value ? colors.foreground : colors.card }]}
              >
                <Text style={{ color: rating === value ? colors.background : colors.foreground, fontFamily: fonts.sansSemi }}>{value}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.between}>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Совсем не полезен", "Пайдасы болмады")}</Text>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Очень полезен", "Өте пайдалы")}</Text>
          </View>
          <SelectSheet
            label={tr("Планируете купить доступ?", "Ақылы қолжетімділікті алуды жоспарлайсыз ба?")}
            value={intent}
            options={[{ value: "", label: tr("Выберите ответ", "Жауапты таңдаңыз") }, ...intents.map(([value, ru, kk]) => ({ value, label: tr(ru, kk) }))]}
            onChange={setIntent}
          />
          <SelectSheet
            label={tr("Что мешает продолжить?", "Жалғастыруға не кедергі?")}
            value={blocker}
            options={[{ value: "", label: tr("Выберите ответ", "Жауапты таңдаңыз") }, ...blockers.map(([value, ru, kk]) => ({ value, label: tr(ru, kk) }))]}
            onChange={setBlocker}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>{tr("Что улучшить? Необязательно", "Нені жақсарту керек? Міндетті емес")}</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            maxLength={1000}
            multiline
            editable={!busy}
            placeholder={tr("Не указывайте телефон и другие личные данные", "Телефон мен басқа жеке деректерді жазбаңыз")}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />
          {failure ? (
            <Text accessibilityRole="alert" style={[styles.small, { color: colors.destructive }]}>
              {failure}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <Button variant="ghost" onPress={dismiss}>
              {tr("Не сейчас", "Кейінірек")}
            </Button>
            <Button disabled={busy || !rating || !intent || !blocker} onPress={() => void save()}>
              {busy ? tr("Отправляем…", "Жіберілуде…") : tr("Отправить отзыв", "Пікір жіберу")}
            </Button>
          </View>
        </View>
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  thanks: { fontSize: 13, lineHeight: 19 },
  form: { gap: 10, paddingTop: 12 },
  label: { fontSize: 14, fontFamily: fonts.sansSemi },
  small: { fontSize: 12 },
  rating: { flexDirection: "row", gap: 8 },
  star: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  input: { minHeight: 76, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 14, textAlignVertical: "top", fontFamily: fonts.sans },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 },
})
