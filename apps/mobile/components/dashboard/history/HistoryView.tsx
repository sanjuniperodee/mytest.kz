import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useMemo, useState } from "react"
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { ExamType, SessionListItem } from "@/lib/api/types"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"
import { useUiLocale } from "@/lib/i18n/ui"

type SessionsResponse = SessionListItem[] | { items?: SessionListItem[]; total?: number; totalPages?: number }
const PAGE_SIZE = 20

export function HistoryView() {
  const { colors } = useAppTheme()
  const { user } = useAuth()
  const { locale: ui } = useUiLocale()
  const locale = ((user?.preferredLanguage as Locale) || ui) as Locale
  const [page, setPage] = useState(1)
  const [examTypeId, setExamTypeId] = useState("all")
  const [pickerOpen, setPickerOpen] = useState(false)
  const { data: examTypes } = useSWR<ExamType[]>("/exams/types")
  const key = `/tests/sessions?page=${page}&limit=${PAGE_SIZE}${examTypeId === "all" ? "" : `&examTypeId=${encodeURIComponent(examTypeId)}`}`
  const { data, isLoading } = useSWR<SessionsResponse>(key)
  const sessions = Array.isArray(data) ? data : data?.items ?? []
  const totalPages = Array.isArray(data) ? undefined : data?.totalPages ?? (data?.total != null ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : undefined)
  const options = useMemo(() => [
    { value: "all", label: ui === "kk" ? "Барлық емтихандар" : "Все экзамены" },
    ...(examTypes ?? []).map((exam) => ({ value: exam.id, label: localize(exam.name, locale, ui === "kk" ? "Емтихан" : "Экзамен") })),
  ], [examTypes, locale, ui])
  const selectedLabel = options.find((item) => item.value === examTypeId)?.label ?? options[0].label

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: colors.secondary }]}> 
      <Text style={[styles.h1, { color: colors.foreground }]}>{ui === "kk" ? "Емтихандар тарихы" : "История экзаменов"}</Text>
      <Text style={[styles.lead, { color: colors.mutedForeground }]}>{ui === "kk" ? "Барлық емтихандар бойынша барлық әрекеттеріңіз" : "Все твои попытки по всем экзаменам"}</Text>
      <Pressable onPress={() => setPickerOpen(true)} style={[styles.filter, { borderColor: colors.border, backgroundColor: colors.card }]}><Text numberOfLines={1} style={[styles.filterText, { color: colors.foreground }]}>{selectedLabel}</Text><MaterialCommunityIcons name="chevron-down" size={20} color={colors.mutedForeground} /></Pressable>

      <Card style={styles.listCard}>
        {isLoading ? Array.from({ length: 6 }).map((_, index) => <View key={index} style={[styles.skeleton, { backgroundColor: colors.secondary }]} />) : sessions.length === 0 ? (
          <View style={styles.empty}><View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}><MaterialCommunityIcons name="history" size={24} color={colors.mutedForeground} /></View><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{ui === "kk" ? "Әзірше әрекеттер жоқ" : "Пока нет попыток"}</Text><Text style={[styles.emptyLead, { color: colors.mutedForeground }]}>{ui === "kk" ? "Сынақ емтиханын бастаңыз — тарих осында пайда болады." : "Начни пробный экзамен, и история появится здесь."}</Text><Button onPress={() => router.push("/dashboard/exams")}>{ui === "kk" ? "Емтихандарға" : "К экзаменам"}</Button></View>
        ) : sessions.map((session, index) => {
          const score = session.maxScore != null && (session.rawScore != null || session.score != null) ? `${session.rawScore ?? session.score}/${session.maxScore}` : "—"
          const inProgress = session.status === "in_progress"
          return <Pressable key={session.id} onPress={() => router.push((inProgress ? `/exam/${session.id}` : `/exam/${session.id}/review`) as never)} style={[styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><View style={styles.rowMain}><Text numberOfLines={1} style={[styles.examName, { color: colors.foreground }]}>{localize(session.examType?.name, locale, ui === "kk" ? "Сынақ тесті" : "Пробный тест")}</Text><Text style={[styles.date, { color: colors.mutedForeground }]}>{formatStartedAt(session.startedAt, ui)}</Text></View><View style={styles.rowMeta}><Text style={[styles.score, { color: colors.foreground }]}>{score}</Text><View style={[styles.status, { backgroundColor: inProgress ? "#fef3c7" : "#dcfce7" }]}><Text style={{ color: inProgress ? "#92400e" : "#166534", fontSize: 11, fontFamily: fonts.sansSemi }}>{inProgress ? (ui === "kk" ? "Жалғасуда" : "В процессе") : (ui === "kk" ? "Аяқталды" : "Завершён")}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground} /></View></Pressable>
        })}
      </Card>

      <View style={styles.pagination}><Button variant="outline" disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))}>{ui === "kk" ? "Артқа" : "Назад"}</Button><Text style={[styles.page, { color: colors.mutedForeground }]}>{ui === "kk" ? `${page}-бет` : `Страница ${page}`}{totalPages ? ` / ${totalPages}` : ""}</Text><Button variant="outline" disabled={totalPages != null ? page >= totalPages : sessions.length < PAGE_SIZE} onPress={() => setPage((value) => value + 1)}>{ui === "kk" ? "Келесі" : "Далее"}</Button></View>
      <HistoryPicker visible={pickerOpen} title={ui === "kk" ? "Емтихан" : "Экзамен"} options={options} value={examTypeId} onSelect={(value) => { setExamTypeId(value); setPage(1); setPickerOpen(false) }} onClose={() => setPickerOpen(false)} />
    </ScrollView>
  )
}

function HistoryPicker({ visible, title, options, value, onSelect, onClose }: { visible: boolean; title: string; options: { value: string; label: string }[]; value: string; onSelect: (value: string) => void; onClose: () => void }) {
  const { colors } = useAppTheme()
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalWrap}><Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} /><View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text><FlatList data={options} keyExtractor={(item) => item.value} style={{ maxHeight: 380 }} renderItem={({ item }) => <Pressable onPress={() => onSelect(item.value)} style={[styles.pickerRow, { borderBottomColor: colors.border, backgroundColor: item.value === value ? colors.secondary : "transparent" }]}><Text style={[styles.pickerText, { color: colors.foreground }]}>{item.label}</Text>{item.value === value ? <MaterialCommunityIcons name="check" size={20} color={colors.foreground} /> : null}</Pressable>} /></View></View></Modal>
}

function formatStartedAt(value: string | undefined, ui: "ru" | "kk") {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(ui === "kk" ? "kk-KZ" : "ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 30 },
  h1: { fontSize: 28, fontFamily: fonts.sansSemi, letterSpacing: -0.5 },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 3, marginBottom: 15 },
  filter: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  filterText: { flex: 1, fontSize: 14, fontFamily: fonts.sansSemi },
  listCard: { padding: 0, overflow: "hidden" },
  skeleton: { height: 72, margin: 8, borderRadius: 10 },
  row: { minHeight: 76, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  rowMain: { flex: 1, minWidth: 0 },
  examName: { fontSize: 14, fontFamily: fonts.sansSemi },
  date: { fontSize: 11, marginTop: 5 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  score: { fontSize: 13, fontFamily: fonts.sansSemi, fontVariant: ["tabular-nums"] },
  status: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  empty: { alignItems: "center", padding: 30, gap: 8 },
  emptyIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontFamily: fonts.sansSemi },
  emptyLead: { fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 5 },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 },
  page: { fontSize: 12, textAlign: "center" },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  modalSheet: { maxHeight: "70%", borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 },
  modalTitle: { fontSize: 18, fontFamily: fonts.sansSemi, marginBottom: 8 },
  pickerRow: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10 },
  pickerText: { flex: 1, fontSize: 14 },
})
