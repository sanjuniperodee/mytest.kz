import { MaterialCommunityIcons } from "@expo/vector-icons"
import useSWR from "swr"
import { useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Card } from "@/components/ui/card"
import { EntProgressLineChart } from "@/components/dashboard/EntProgressLineChart"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

const PAGE_SIZE = 15

type EntHistorySession = {
  sessionId: string
  date: string | null
  rawScore: number | null
  maxScore: number | null
  score: number | null
  correctCount: number | null
  totalQuestions: number
  language: string | null
}

type EntHistoryPaginatedResponse = {
  sessions: EntHistorySession[]
  chartSessions: EntHistorySession[]
  total: number
  page: number
  limit: number
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function StatsSkeleton({ colors }: { colors: { secondary: string; border: string } }) {
  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.skelTitle, { backgroundColor: colors.secondary }]} />
      <View style={[styles.skelChart, { backgroundColor: colors.secondary }]} />
    </View>
  )
}

export function StatsEntView() {
  const { colors, resolved } = useAppTheme()
  const [page, setPage] = useState(1)

  const swrKey = `/users/me/ent-history?page=${page}&limit=${PAGE_SIZE}`
  const { data, isLoading } = useSWR<EntHistoryPaginatedResponse>(swrKey)

  const total = data?.total ?? 0
  const limit = data?.limit ?? PAGE_SIZE
  const chartSessions = data?.chartSessions ?? []
  const tableSessions = data?.sessions ?? []

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const safePage = Math.min(page, totalPages)
  const rangeStart = total === 0 ? 0 : (safePage - 1) * limit + 1
  const rangeEnd = Math.min(safePage * limit, total)

  useEffect(() => {
    if (!data) return
    const tp = Math.max(1, Math.ceil(data.total / data.limit))
    if (page > tp) setPage(tp)
  }, [data, page])

  const chartPoints = useMemo(
    () =>
      chartSessions.map((s, i) => ({
        attempt: i + 1,
        score: s.rawScore ?? 0,
      })),
    [chartSessions],
  )
  const rawVals = chartSessions.map((s) => s.rawScore).filter((n): n is number => n != null)
  const yMax = rawVals.length > 0 ? Math.max(...rawVals) + 10 : 140

  const stroke = colors.foreground
  const grid =
    resolved === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"

  const canPrev = safePage > 1
  const canNext = safePage < totalPages

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: colors.secondary }]}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="chart-bar" size={26} color={colors.foreground} />
        <Text style={[styles.h1, { color: colors.foreground }]}>Динамика ЕНТ</Text>
      </View>

      {isLoading ? (
        <StatsSkeleton colors={colors} />
      ) : total === 0 ? (
        <Card>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            Пока нет данных. Сдайте первый пробный ЕНТ, чтобы увидеть график.
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Прогресс по попыткам
            </Text>
            <Text style={[styles.chartHint, { color: colors.mutedForeground }]}>
              Последние {chartSessions.length} попыток (хронологически)
            </Text>
            <View style={{ marginTop: 12 }}>
              <EntProgressLineChart
                data={chartPoints}
                height={256}
                strokeColor={stroke}
                gridColor={grid}
                dotFill={colors.card}
                yDomainMax={yMax}
              />
            </View>
          </Card>

          <Card style={{ marginTop: 12 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              История попыток
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ marginTop: 12 }}>
                <View style={[styles.tr, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.th, { color: colors.mutedForeground }]}>Дата</Text>
                  <Text style={[styles.th, styles.cellNum, { color: colors.mutedForeground }]}>
                    Балл
                  </Text>
                  <Text style={[styles.th, styles.cellNum, { color: colors.mutedForeground }]}>
                    Макс
                  </Text>
                  <Text style={[styles.th, styles.cellNum, { color: colors.mutedForeground }]}>
                    %
                  </Text>
                  <Text style={[styles.th, styles.cellLang, { color: colors.mutedForeground }]}>
                    Язык
                  </Text>
                </View>
                {tableSessions.map((s) => {
                  const pct =
                    s.rawScore != null && s.maxScore != null && s.maxScore > 0
                      ? Math.round((s.rawScore / s.maxScore) * 100)
                      : null
                  return (
                    <View
                      key={s.sessionId}
                      style={[styles.tr, { borderBottomColor: colors.border }]}
                    >
                      <Text style={[styles.td, { color: colors.foreground }]}>
                        {formatDate(s.date)}
                      </Text>
                      <Text
                        style={[styles.td, styles.cellNum, { fontFamily: fonts.sansSemi, color: colors.foreground }]}
                      >
                        {s.rawScore ?? "-"}
                      </Text>
                      <Text style={[styles.td, styles.cellNum, { color: colors.foreground }]}>
                        {s.maxScore ?? "-"}
                      </Text>
                      <Text style={[styles.td, styles.cellNum, { color: colors.foreground }]}>
                        {pct != null ? `${pct}%` : "-"}
                      </Text>
                      <Text
                        style={[styles.td, styles.cellLang, { color: colors.foreground }]}
                      >
                        {(s.language ?? "-").toUpperCase()}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </ScrollView>

            <View style={[styles.pager, { borderTopColor: colors.border }]}>
              <Text style={[styles.pagerMeta, { color: colors.mutedForeground }]}>
                {rangeStart}–{rangeEnd} из {total}
              </Text>
              <View style={styles.pagerBtns}>
                <Pressable
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!canPrev}
                  style={({ pressed }) => [
                    styles.pagerBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      opacity: !canPrev ? 0.35 : pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Предыдущая страница"
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={22}
                    color={colors.foreground}
                  />
                </Pressable>
                <Text style={[styles.pagerPage, { color: colors.foreground }]}>
                  {safePage} / {totalPages}
                </Text>
                <Pressable
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!canNext}
                  style={({ pressed }) => [
                    styles.pagerBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      opacity: !canNext ? 0.35 : pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Следующая страница"
                >
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={22}
                    color={colors.foreground}
                  />
                </Pressable>
              </View>
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 120 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  h1: { fontSize: 24, fontFamily: fonts.sansSemi, letterSpacing: -0.35 },
  cardTitle: { fontSize: 16, fontFamily: fonts.sansSemi },
  chartHint: { fontSize: 12, marginTop: 6, lineHeight: 16 },
  empty: { textAlign: "center", paddingVertical: 36, fontSize: 15, lineHeight: 22 },
  skelTitle: { height: 28, width: 160, borderRadius: 8 },
  skelChart: { height: 256, borderRadius: 12 },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 12,
    minWidth: 340,
  },
  th: { fontSize: 12, fontFamily: fonts.sansSemi, flex: 1.4 },
  td: { fontSize: 13, flex: 1.4 },
  cellNum: { flex: 0.75, textAlign: "right", fontVariant: ["tabular-nums"] },
  cellLang: { flex: 0.65, textAlign: "center" },
  pager: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  pagerMeta: { fontSize: 13, fontVariant: ["tabular-nums"] },
  pagerBtns: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  pagerBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  pagerPage: {
    fontSize: 15,
    fontFamily: fonts.sansSemi,
    fontVariant: ["tabular-nums"],
    minWidth: 56,
    textAlign: "center",
  },
})
