import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Card } from "@/components/ui/card"
import { RichHtml } from "@/components/exam/RichHtml"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import type { AiTopicLesson, TestSession } from "@/lib/api/types"
import { useUiLocale } from "@/lib/i18n/ui"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

export function ThemeLessonView({ themeId }: { themeId: string }) {
  const { colors } = useAppTheme()
  const { locale: ui } = useUiLocale()
  const { user, isLoading: authLoading } = useAuth()
  const language: "ru" | "kk" = user?.preferredLanguage === "kk" ? "kk" : "ru"
  const hasPremium = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const [lesson, setLesson] = useState<AiTopicLesson | null>(null)
  const [loading, setLoading] = useState(false)
  const [training, setTraining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)

  const loadLesson = useCallback(async () => {
    if (!themeId || !hasPremium) return
    setLoading(true)
    setError(null)
    try {
      setLesson(await api<AiTopicLesson>("/ai/mistakes/theme-lesson", { method: "POST", body: { themeId, language } }))
    } catch (loadError) {
      if (loadError instanceof ApiError && (loadError.status === 402 || loadError.status === 403)) {
        router.replace("/dashboard/billing?reason=theme_lesson" as never)
        return
      }
      setError(lessonError(loadError, ui))
    } finally {
      setLoading(false)
    }
  }, [hasPremium, language, themeId, ui])

  useEffect(() => { if (!authLoading && hasPremium) void loadLesson() }, [authLoading, hasPremium, loadLesson])

  const startPractice = async () => {
    if (!lesson) return
    setTraining(true)
    try {
      const session = await api<TestSession>("/tests/mistakes/practice", {
        method: "POST",
        body: { language, examTypeId: lesson.examTypeId, subjectId: lesson.subjectId, themeId: lesson.topicId, limit: 15, durationMins: 25 },
      })
      router.push(`/exam/${session.id}` as never)
    } catch (practiceError) {
      Alert.alert(ui === "kk" ? "Қате" : "Ошибка", lessonError(practiceError, ui))
    } finally {
      setTraining(false)
    }
  }

  const sendNote = async () => {
    const message = note.trim()
    if (!lesson?.lessonId || message.length < 12) return
    setSending(true)
    try {
      await api(`/ai/mistakes/theme-lesson/${lesson.lessonId}/note`, { method: "POST", body: { message } })
      setNote("")
      setNoteOpen(false)
      Alert.alert(ui === "kk" ? "Дайын" : "Готово", ui === "kk" ? "Ескерту әкімшіге жіберілді." : "Замечание отправлено администратору.")
    } catch (noteError) {
      Alert.alert(ui === "kk" ? "Қате" : "Ошибка", lessonError(noteError, ui))
    } finally {
      setSending(false)
    }
  }

  if (authLoading || loading) return <View style={[styles.center, { backgroundColor: colors.secondary }]}><ActivityIndicator color="#7c3aed" /><Text style={{ color: colors.mutedForeground }}>{ui === "kk" ? "AI толық сабақ дайындауда…" : "AI готовит полный урок…"}</Text></View>

  if (!hasPremium) return (
    <View style={[styles.center, { backgroundColor: colors.secondary }]}>
      <Card style={{ backgroundColor: "#fffbeb", borderColor: "#fde68a" }}>
        <Text style={styles.premiumTitle}>{ui === "kk" ? "Жеке сабақ Premium-де қолжетімді" : "Персональный урок доступен в Premium"}</Text>
        <Text style={styles.premiumText}>{ui === "kk" ? "Premium AI-сабақтарды, мысалдарды және шағын тестті ашады." : "Premium откроет AI-уроки, примеры и мини-тест."}</Text>
        <Action label={ui === "kk" ? "Premium ашу" : "Открыть Premium"} onPress={() => router.replace("/dashboard/billing?reason=theme_lesson" as never)} />
      </Card>
    </View>
  )

  if (!lesson) return (
    <View style={[styles.center, { backgroundColor: colors.secondary }]}>
      <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>{error ?? (ui === "kk" ? "Сабақты ашу мүмкін болмады." : "Не удалось открыть урок.")}</Text>
      <Action label={ui === "kk" ? "Қайталау" : "Повторить"} onPress={() => void loadLesson()} />
    </View>
  )

  return (
    <>
      <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.secondary }]}>
        <Pressable onPress={() => router.push(`/dashboard/mistakes/subjects/${lesson.subjectId}` as never)} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={18} color={colors.foreground} /><Text style={{ color: colors.foreground, fontFamily: fonts.sansSemi }}>{ui === "kk" ? "Пәнге" : "К предмету"}</Text></Pressable>
        <Card style={{ borderColor: "#a7f3d0" }}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{lesson.subjectName} · {lesson.topicName}</Text>
          <Text style={[styles.h1, { color: colors.foreground }]}>{lesson.title}</Text>
          <View style={styles.actions}><Action disabled={training} label={training ? "…" : (ui === "kk" ? "Жаттығу" : "Тренировать")} onPress={() => void startPractice()} /><Action outline label={ui === "kk" ? "Ескерту" : "Замечание"} onPress={() => setNoteOpen(true)} /></View>
          <LessonText title={ui === "kk" ? "Мақсат" : "Цель"} value={lesson.studentGoal} locale={language} />
          <LessonText title={ui === "kk" ? "ҰБТ үшін маңызы" : "Зачем на ЕНТ"} value={lesson.whyItMatters} locale={language} />
        </Card>

        {(lesson.pages?.length ? lesson.pages : []).map((page, pageIndex) => (
          <Card key={`${page.slug}:${pageIndex}`}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{page.title}</Text>
            {page.goal ? <Text style={[styles.goal, { color: colors.mutedForeground }]}>{page.goal}</Text> : null}
            <RichHtml value={page.content} locale={language} readingComfort />
            {page.examples.map((example, index) => <Example key={index} title={example.title} question={example.question} steps={example.steps} answer={example.answer} trap={example.trap} locale={language} />)}
            {page.practice.map((item, index) => <Practice key={index} item={item} locale={language} />)}
            {page.checklist.length ? <ListBlock title={ui === "kk" ? "Тексеру тізімі" : "Чек-лист"} items={page.checklist} /> : null}
          </Card>
        ))}

        {!lesson.pages?.length ? lesson.sections.map((section, index) => <Card key={index}><LessonText title={section.title} value={section.content} locale={language} /></Card>) : null}
        {lesson.formulas.length ? <Card><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ui === "kk" ? "Формулалар" : "Формулы"}</Text>{lesson.formulas.map((formula, index) => <View key={index} style={[styles.box, { borderColor: colors.border }]}><RichHtml value={`$$${formula.latex}$$`} locale={language} /><Text style={[styles.body, { color: colors.mutedForeground }]}>{formula.note}</Text></View>)}</Card> : null}
        {lesson.visualizations.length ? <Card><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ui === "kk" ? "Деректер" : "Визуализации"}</Text>{lesson.visualizations.map((chart, index) => <View key={index} style={[styles.box, { borderColor: colors.border }]}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{chart.title}</Text>{chart.data.map((row, rowIndex) => <View key={rowIndex} style={styles.dataRow}><Text style={[styles.body, { color: colors.mutedForeground, flex: 1 }]}>{row.label}</Text><Text style={[styles.body, { color: colors.foreground, fontFamily: fonts.sansSemi }]}>{row.value}{row.secondValue != null ? ` / ${row.secondValue}` : ""}</Text></View>)}</View>)}</Card> : null}
        {lesson.workedExamples.length ? <Card><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ui === "kk" ? "Шешілген мысалдар" : "Разобранные примеры"}</Text>{lesson.workedExamples.map((example, index) => <Example key={index} {...example} locale={language} />)}</Card> : null}
        {lesson.practice.length ? <Card><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ui === "kk" ? "Практика" : "Практика"}</Text>{lesson.practice.map((item, index) => <Practice key={index} item={item} locale={language} />)}</Card> : null}
        {lesson.commonTraps.length ? <Card><ListBlock title={ui === "kk" ? "Жиі қателер" : "Типичные ловушки"} items={lesson.commonTraps} /></Card> : null}
        {lesson.checklist.length ? <Card><ListBlock title={ui === "kk" ? "Тексеру тізімі" : "Чек-лист"} items={lesson.checklist} /></Card> : null}
        {lesson.miniTest.length ? <Card><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ui === "kk" ? "Шағын тест" : "Мини-тест"}</Text>{lesson.miniTest.map((item, index) => <Practice key={index} item={item} locale={language} />)}</Card> : null}
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{lesson.cached ? (ui === "kk" ? "Сақталған сабақ" : "Сохранённый урок") : (ui === "kk" ? "Қазір жасалды" : "Сгенерировано сейчас")} · {lesson.model}</Text>
      </ScrollView>

      <Modal visible={noteOpen} transparent animationType="slide" onRequestClose={() => setNoteOpen(false)}>
        <View style={styles.modalWrap}><Pressable style={StyleSheet.absoluteFillObject} onPress={() => setNoteOpen(false)} /><View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ui === "kk" ? "Сабаққа ескерту" : "Замечание к уроку"}</Text><TextInput value={note} onChangeText={setNote} multiline maxLength={2000} placeholder={ui === "kk" ? "Қате немесе дәлсіздікті сипаттаңыз" : "Опишите ошибку или неточность"} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]} /><View style={styles.actions}><Action outline label={ui === "kk" ? "Жабу" : "Закрыть"} onPress={() => setNoteOpen(false)} /><Action disabled={sending || note.trim().length < 12 || !lesson.lessonId} label={sending ? "…" : (ui === "kk" ? "Жіберу" : "Отправить")} onPress={() => void sendNote()} /></View></View></View>
      </Modal>
    </>
  )
}

function LessonText({ title, value, locale }: { title: string; value: string; locale: "ru" | "kk" }) {
  const { colors } = useAppTheme()
  return <View style={styles.lessonText}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{title}</Text><RichHtml value={value} locale={locale} readingComfort /></View>
}

function Example({ title, question, steps, answer, trap, locale }: { title: string; question: string; steps: string[]; answer: string; trap: string; locale: "ru" | "kk" }) {
  const { colors } = useAppTheme()
  return <View style={[styles.box, { borderColor: colors.border }]}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{title}</Text><RichHtml value={question} locale={locale} />{steps.map((step, index) => <Text key={index} style={[styles.body, { color: colors.foreground }]}>{index + 1}. {step}</Text>)}<RichHtml value={`**Ответ:** ${answer}`} locale={locale} />{trap ? <Text style={[styles.body, { color: "#b45309" }]}>⚠ {trap}</Text> : null}</View>
}

function Practice({ item, locale }: { item: { prompt: string; options: string[]; answer: string; explanation: string }; locale: "ru" | "kk" }) {
  const { colors } = useAppTheme()
  const [open, setOpen] = useState(false)
  return <View style={[styles.box, { borderColor: colors.border }]}><RichHtml value={item.prompt} locale={locale} />{item.options.map((option, index) => <Text key={index} style={[styles.body, { color: colors.foreground }]}>{String.fromCharCode(65 + index)}. {option}</Text>)}<Pressable onPress={() => setOpen((value) => !value)}><Text style={[styles.reveal, { color: "#6d28d9" }]}>{open ? "Скрыть ответ" : "Показать ответ"}</Text></Pressable>{open ? <><RichHtml value={`**Ответ:** ${item.answer}`} locale={locale} /><RichHtml value={item.explanation} locale={locale} /></> : null}</View>
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  const { colors } = useAppTheme()
  return <View style={styles.list}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{title}</Text>{items.map((item, index) => <Text key={index} style={[styles.body, { color: colors.foreground }]}>• {item}</Text>)}</View>
}

function Action({ label, onPress, disabled, outline }: { label: string; onPress: () => void; disabled?: boolean; outline?: boolean }) {
  const { colors } = useAppTheme()
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: outline ? colors.card : colors.foreground, borderColor: outline ? colors.border : colors.foreground, opacity: disabled ? .45 : pressed ? .84 : 1 }]}><Text style={{ color: outline ? colors.foreground : colors.background, fontFamily: fonts.sansSemi, textAlign: "center" }}>{label}</Text></Pressable>
}

function lessonError(error: unknown, ui: "ru" | "kk") {
  const code = error instanceof ApiError ? error.message : "NETWORK"
  if (ui === "kk") return code === "AI_DAILY_LIMIT" ? "Бүгінгі AI лимиті аяқталды." : code === "AI_BUSY" ? "AI бос емес, кейінірек қайталаңыз." : "Әрекетті орындау мүмкін болмады."
  if (code === "AI_DAILY_LIMIT") return "Дневной лимит AI исчерпан."
  if (code === "AI_BUSY") return "AI перегружен, попробуйте позже."
  if (code === "NO_OPEN_MISTAKES_FOR_THEME") return "По этой теме нет открытых ошибок."
  return code === "NETWORK" ? "Проверьте интернет и повторите попытку." : "Не удалось выполнить действие."
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 120, gap: 16 },
  center: { flex: 1, minHeight: 360, justifyContent: "center", alignItems: "center", gap: 12, padding: 20 },
  back: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", minHeight: 40 },
  eyebrow: { fontSize: 12, color: "#047857", fontFamily: fonts.sansSemi },
  h1: { fontSize: 26, lineHeight: 33, fontFamily: fonts.sansSemi, marginTop: 7 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 43, justifyContent: "center", paddingHorizontal: 15, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  lessonText: { marginTop: 16 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.sansSemi, marginBottom: 8 },
  itemTitle: { fontSize: 14, fontFamily: fonts.sansSemi, marginBottom: 5 },
  goal: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginTop: 10 },
  body: { fontSize: 13, lineHeight: 20 },
  list: { gap: 6, marginTop: 12 },
  dataRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  reveal: { fontSize: 13, fontFamily: fonts.sansSemi, marginTop: 8 },
  meta: { fontSize: 12, textAlign: "center" },
  premiumTitle: { color: "#78350f", fontSize: 17, fontFamily: fonts.sansSemi },
  premiumText: { color: "#92400e", fontSize: 13, lineHeight: 20, marginTop: 6 },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.4)" },
  sheet: { borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 30 },
  input: { minHeight: 130, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, textAlignVertical: "top", fontSize: 14 },
})
