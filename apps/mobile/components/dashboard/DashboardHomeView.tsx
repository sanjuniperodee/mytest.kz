import { MaterialCommunityIcons } from "@expo/vector-icons"
import useSWR from "swr"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from "react-native"
import { router } from "expo-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { EntProgressLineChart } from "@/components/dashboard/EntProgressLineChart"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type {
  AccessByExamItem,
  ExamType,
  PaginatedResponse,
  SessionListItem,
  UserExamStats,
  UserStats,
} from "@/lib/api/types"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"
import { t, useUiLocale, type UiLocale } from "@/lib/i18n/ui"

function clampPct(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

const SESSIONS_PAGE_SIZE = 10

function formatBestPoints(item: UserExamStats): string {
  if (item.bestRawScore != null && item.bestMaxScore != null) {
    return `${item.bestRawScore}/${item.bestMaxScore}`
  }
  if (item.bestScore != null) return `${Math.round(item.bestScore)}%`
  return "—"
}

function formatDuration(seconds: number | null | undefined, ui: UiLocale): string {
  if (seconds == null || seconds <= 0) return "—"
  const minutes = Math.round(seconds / 60)
  return `${minutes}${t("minutesShort", ui)}`
}

function accessReasonLabel(reason: AccessByExamItem["reasonCode"], ui: UiLocale): string {
  if (reason === "DAILY_LIMIT_REACHED") return t("accessLimitDay", ui)
  if (reason === "TOTAL_LIMIT_EXHAUSTED") return t("accessLimitTotal", ui)
  if (reason === "NO_ENTITLEMENT") return t("accessNoAccess", ui)
  return t("accessNoAccess", ui)
}

function formatAccessLine(item: AccessByExamItem, ui: UiLocale): string {
  if (item.daily.isUnlimited) return t("accessUnlimitedDaily", ui)
  if (item.daily.limit == null) return t("accessDailyUnset", ui)
  return `${t("accessTodayPrefix", ui)}${item.daily.remaining ?? 0}/${item.daily.limit}`
}

function formatDailyRemaining(item: AccessByExamItem | undefined, ui: UiLocale): string {
  if (!item) return "—"
  if (item.daily.isUnlimited) return t("accessUnlimitedShort", ui)
  if (item.daily.limit == null) return "—"
  return `${item.daily.remaining ?? 0}/${item.daily.limit}`
}

function formatFreeTrialRemaining(trial: {
  freeRemaining?: number
  freeLimit?: number
  remaining?: number
  limit?: number
} | undefined): string {
  if (!trial) return "—"
  const remaining = trial.freeRemaining ?? trial.remaining ?? 0
  const limit = trial.freeLimit ?? trial.limit ?? 0
  return `${remaining}/${limit}`
}

function statAccentPalette(resolved: "light" | "dark") {
  if (resolved === "dark") {
    return {
      emerald: { bg: "rgba(16,185,129,0.22)", fg: "#6EE7B7" },
      blue: { bg: "rgba(59,130,246,0.22)", fg: "#93C5FD" },
      amber: { bg: "rgba(245,158,11,0.22)", fg: "#FCD34D" },
      orange: { bg: "rgba(249,115,22,0.22)", fg: "#FDBA74" },
    }
  }
  return {
    emerald: { bg: "#D1FAE5", fg: "#047857" },
    blue: { bg: "#DBEAFE", fg: "#1D4ED8" },
    amber: { bg: "#FEF3C7", fg: "#B45309" },
    orange: { bg: "#FFEDD5", fg: "#C2410C" },
  }
}

export function DashboardHomeView() {
  const { colors, resolved } = useAppTheme()
  const accents = statAccentPalette(resolved)
  const { locale: ui } = useUiLocale()
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const dateLocale = ui === "kk" ? "kk-KZ" : "ru-RU"

  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.telegramUsername ||
    user?.username ||
    ""

  const { data: stats, isLoading: statsLoading } = useSWR<UserStats>("/users/me/stats")

  const { data: inProgressResp } = useSWR<PaginatedResponse<SessionListItem>>(
    "/tests/sessions?page=1&limit=1&status=in_progress",
  )
  const inProgress = inProgressResp?.items?.[0]

  const [sessPage, setSessPage] = useState(1)
  const { data: sessData, isLoading: sessLoading } = useSWR<PaginatedResponse<SessionListItem>>(
    `/tests/sessions?page=${sessPage}&limit=${SESSIONS_PAGE_SIZE}`,
  )

  const sessionList = sessData?.items ?? []
  const sessTotal = sessData?.total ?? 0
  const sessLimit = sessData?.limit ?? SESSIONS_PAGE_SIZE

  useEffect(() => {
    if (!sessData) return
    const tp = Math.max(1, Math.ceil(sessData.total / sessData.limit))
    if (sessPage > tp) setSessPage(tp)
  }, [sessData, sessPage])

  const sessTotalPages = Math.max(1, Math.ceil(sessTotal / sessLimit))
  const sessSafePage = Math.min(sessPage, sessTotalPages)
  const sessRangeStart = sessTotal === 0 ? 0 : (sessSafePage - 1) * sessLimit + 1
  const sessRangeEnd = Math.min(sessSafePage * sessLimit, sessTotal)
  const sessCanPrev = sessSafePage > 1
  const sessCanNext = sessSafePage < sessTotalPages

  const { data: examTypes } = useSWR<ExamType[]>("/exams/types")
  const entExam = (examTypes || []).find((exam) => exam.slug === "ent")
  const quickStartPath = entExam ? `/dashboard/exams/${entExam.id}` : "/dashboard/exams"
  const entAccess = user?.accessByExam?.find((item) => item.examSlug === "ent")
  const entTrial = user?.trialStatus?.ent
  const hasPaidSubscription = Boolean(user?.hasActiveSubscription)
  const tariffName = localize(
    user?.currentTariff?.name,
    locale,
    hasPaidSubscription ? t("billTariffDefaultPaid", ui) : t("billTariffDefaultFree", ui),
  )
  const bestExam =
    stats?.byExamType?.reduce<UserExamStats | null>((best, item) => {
      if (item.bestScore == null) return best
      if (!best || best.bestScore == null || item.bestScore > best.bestScore) return item
      return best
    }, null) ?? null
  const entStats = stats?.byExamType?.find((item) => item.examSlug === "ent")
  const averageResult = stats ? `${Math.round(stats.averageScore)}%` : "—"
  const bestResult = bestExam ? formatBestPoints(bestExam) : stats?.bestScore ?? "—"

  const chartGrid = resolved === "dark" ? colors.border : `${colors.border}99`

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.secondary }]}>
      {/* Hero — как на web */}
      <Card style={styles.heroCard}>
        <View style={[styles.heroBadge, { backgroundColor: `${colors.accent}22` }]}>
          <MaterialCommunityIcons name="star-four-points-small" size={14} color={colors.accent} />
          <Text style={[styles.heroBadgeText, { color: colors.accent }]}>{t("homeHeroBadge", ui)}</Text>
        </View>
        <View style={styles.heroTop}>
          <View style={styles.heroTextCol}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              {t("homeGreetingHi", ui)}
              {userName ? `, ${userName.split(" ")[0]}` : ""}.
            </Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>{t("homeSub", ui)}</Text>
            <View style={[styles.heroLimits, !hasPaidSubscription && styles.heroLimitsThree]}>
              <HeroLimit label={t("homeTariff", ui)} value={tariffName} />
              <HeroLimit label={t("homeDailyLeft", ui)} value={formatDailyRemaining(entAccess, ui)} />
              {!hasPaidSubscription ? (
                <HeroLimit label={t("homeTrialAttempts", ui)} value={formatFreeTrialRemaining(entTrial)} />
              ) : null}
            </View>
          </View>
          {inProgress ? (
            <PrimaryIconButton
              label={t("homeContinue", ui)}
              icon="arrow-right"
              onPress={() => router.push(`/exam/${inProgress.id}`)}
            />
          ) : (
            <PrimaryIconButton
              label={t("homeTakeTrial", ui)}
              icon="book-open-page-variant"
              onPress={() => router.push(quickStartPath as never)}
            />
          )}
        </View>
      </Card>

      {/* Stat grid 2×2 — как lg:grid-cols-4 на узком экране веб даёт 2 колонки */}
      <View style={styles.statGrid}>
        <StatCard
          icon="check-circle"
          label={t("homeStatCompleted", ui)}
          value={stats?.completedTests ?? 0}
          loading={statsLoading}
          accent={accents.emerald}
        />
        <StatCard
          icon="trending-up"
          label={t("homeStatAvg", ui)}
          value={averageResult}
          loading={statsLoading}
          accent={accents.blue}
        />
        <StatCard
          icon="trophy"
          label={t("homeStatBest", ui)}
          value={bestResult}
          loading={statsLoading}
          accent={accents.amber}
        />
        <StatCard
          icon="clock-outline"
          label={t("homeStatInProgress", ui)}
          value={stats?.inProgressSessionsCount ?? 0}
          loading={statsLoading}
          accent={accents.orange}
        />
      </View>

      <EntProgressCard item={entStats} loading={statsLoading} chartGrid={chartGrid} ui={ui} />

      <StatsDashboards
        stats={stats}
        loading={statsLoading}
        locale={locale}
        ui={ui}
        accessByExam={user?.accessByExam ?? []}
      />

      <View style={styles.bottomGrid}>
        <Card padded={false} style={styles.bottomMain}>
          <View style={[styles.cardHeadRow, styles.cardHeadPad]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("homeSessionsTitle", ui)}</Text>
            <Pressable
              onPress={() => router.push(quickStartPath as never)}
              style={styles.linkRow}
            >
              <Text style={[styles.linkText, { color: colors.foreground }]}>
                {t("homeSessionsTakeTrial", ui)}
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={14} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={styles.cardBody}>
            {sessLoading ? (
              <View style={styles.sessSpinner}>
                <Spinner />
              </View>
            ) : sessTotal === 0 ? (
              <EmptySessions ui={ui} onPress={() => router.push(quickStartPath as never)} />
            ) : (
              <View>
                {sessionList.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() =>
                      s.status === "in_progress"
                        ? router.push(`/exam/${s.id}`)
                        : router.push(`/exam/${s.id}/review`)
                    }
                    style={[styles.sessionRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.sessionMeta}>
                      <Text
                        style={[styles.sessionTitle, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {localize(s.examType?.name, locale) || t("homeTrialSessionName", ui)}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.mutedForeground }]}>
                        {s.startedAt
                          ? new Date(s.startedAt).toLocaleString(dateLocale, {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </Text>
                    </View>
                    <View style={styles.sessionRight}>
                      {(s.rawScore != null || s.score != null) && s.maxScore != null ? (
                        <Text style={[styles.sessionScore, { color: colors.foreground }]}>
                          {s.rawScore ?? s.score}/{s.maxScore}
                        </Text>
                      ) : null}
                      <StatusBadge status={s.status} ui={ui} />
                    </View>
                  </Pressable>
                ))}
                {sessTotalPages > 1 ? (
                  <View style={[styles.sessPager, { borderTopColor: colors.border }]}>
                    <Text style={[styles.sessPagerMeta, { color: colors.mutedForeground }]}>
                      {sessRangeStart}–{sessRangeEnd} / {sessTotal}
                    </Text>
                    <View style={styles.sessPagerBtns}>
                      <Pressable
                        onPress={() => setSessPage((p) => Math.max(1, p - 1))}
                        disabled={!sessCanPrev}
                        style={({ pressed }) => [
                          styles.sessPagerBtn,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                            opacity: !sessCanPrev ? 0.35 : pressed ? 0.85 : 1,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Предыдущая страница истории"
                      >
                        <MaterialCommunityIcons
                          name="chevron-left"
                          size={22}
                          color={colors.foreground}
                        />
                      </Pressable>
                      <Text style={[styles.sessPagerPage, { color: colors.foreground }]}>
                        {sessSafePage} / {sessTotalPages}
                      </Text>
                      <Pressable
                        onPress={() => setSessPage((p) => Math.min(sessTotalPages, p + 1))}
                        disabled={!sessCanNext}
                        style={({ pressed }) => [
                          styles.sessPagerBtn,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                            opacity: !sessCanNext ? 0.35 : pressed ? 0.85 : 1,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Следующая страница истории"
                      >
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={22}
                          color={colors.foreground}
                        />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </Card>

        <Card style={styles.bottomAside}>
          <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 12 }]}>
            {t("homeQuickStartTitle", ui)}
          </Text>
          <View style={styles.asideBtns}>
            <PrimaryIconButton
              label={t("homeTakeTrial", ui)}
              icon="book-open-page-variant"
              onPress={() => router.push(quickStartPath as never)}
            />
            <OutlineIconButton
              label={t("homeQuickMistakes", ui)}
              icon="target"
              onPress={() => router.push("/dashboard/mistakes")}
            />
            <GhostIconButton
              label={t("homeQuickLb", ui)}
              icon="trophy"
              onPress={() => router.push("/dashboard/leaderboard")}
            />
            <GhostIconButton
              label={t("homeQuickProgress", ui)}
              icon="trending-up"
              onPress={() => router.push("/dashboard/stats")}
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  )
}

function HeroLimit({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme()
  return (
    <View style={[styles.heroLimitBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Text style={[styles.heroLimitLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.heroLimitValue, { color: colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function PrimaryIconButton({
  label,
  icon,
  onPress,
}: {
  label: string
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]
  onPress: () => void
}) {
  const { colors } = useAppTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.heroCta,
        { backgroundColor: colors.foreground, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={colors.background} />
      <Text style={[styles.heroCtaText, { color: colors.background }]}>{label}</Text>
    </Pressable>
  )
}

function OutlineIconButton({
  label,
  icon,
  onPress,
}: {
  label: string
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]
  onPress: () => void
}) {
  const { colors } = useAppTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sideCta,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={colors.foreground} />
      <Text style={[styles.sideCtaText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  )
}

function GhostIconButton({
  label,
  icon,
  onPress,
}: {
  label: string
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]
  onPress: () => void
}) {
  const { colors } = useAppTheme()
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sideCtaGhost, { opacity: pressed ? 0.75 : 1 }]}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.foreground} />
      <Text style={[styles.sideCtaText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  )
}

function StatCard({
  icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]
  label: string
  value: string | number
  loading: boolean
  accent: { bg: string; fg: string }
}) {
  const { colors } = useAppTheme()
  return (
    <Card style={styles.statCard}>
      <View style={styles.statCardTop}>
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <View style={[styles.statIconBox, { backgroundColor: accent.bg }]}>
          <MaterialCommunityIcons name={icon} size={18} color={accent.fg} />
        </View>
      </View>
      {loading ? (
        <SkeletonBlock h={28} w={56} colors={colors} />
      ) : (
        <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      )}
    </Card>
  )
}

function SkeletonBlock({
  h,
  w,
  colors,
  style,
}: {
  h: number
  w?: number
  colors: { secondary: string }
  style?: ViewStyle
}) {
  return (
    <View
      style={[
        { height: h, borderRadius: 8, backgroundColor: colors.secondary },
        w != null ? { width: w } : { alignSelf: "stretch" },
        style,
      ]}
    />
  )
}

function EntProgressCard({
  item,
  loading,
  chartGrid,
  ui,
}: {
  item?: UserExamStats
  loading: boolean
  chartGrid: string
  ui: UiLocale
}) {
  const { colors } = useAppTheme()
  const scores = item?.recentScores ?? []
  const chartData = scores.map((score, index) => ({
    attempt: index + 1,
    score: clampPct(score),
  }))
  const latest = scores.length > 0 ? clampPct(scores[scores.length - 1]) : null
  const first = scores.length > 0 ? clampPct(scores[0]) : null
  const delta = latest != null && first != null ? latest - first : null

  return (
    <Card padded={false}>
      <View style={[styles.cardHeadRow, styles.cardHeadPad]}>
        <View style={styles.rowCenter}>
          <MaterialCommunityIcons name="trending-up" size={18} color={colors.foreground} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("homeEntProgressTitle", ui)}</Text>
        </View>
        <Badge variant="secondary">{`${t("homeLastNPrefix", ui)}${scores.length}`}</Badge>
      </View>
      <View style={styles.cardBody}>
        {loading ? (
          <SkeletonBlock h={256} colors={colors} style={{ width: "100%" }} />
        ) : scores.length === 0 ? (
          <EmptyDashboard
            icon="trending-up"
            title={t("homeChartEmptyTitle", ui)}
            text={t("homeChartEmptyText", ui)}
          />
        ) : (
          <View style={styles.chartSplit}>
            <EntProgressLineChart
              data={chartData}
              height={256}
              strokeColor={colors.foreground}
              gridColor={chartGrid}
              dotFill={colors.card}
            />
            <View style={styles.chartMetrics}>
              <MiniMetric label={t("homeMiniLast", ui)} value={latest != null ? `${latest}%` : "—"} />
              <MiniMetric label={t("homeMiniBestScore", ui)} value={item ? formatBestPoints(item) : "—"} />
              <MiniMetric
                label={t("homeMiniTrend", ui)}
                value={delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta}%`}
              />
            </View>
          </View>
        )}
      </View>
    </Card>
  )
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  const { colors } = useAppTheme()
  return (
    <View style={[styles.miniMetric, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
      <Text style={[styles.miniMetricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.miniMetricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  )
}

function StatsDashboards({
  stats,
  loading,
  locale,
  ui,
  accessByExam,
}: {
  stats?: UserStats
  loading: boolean
  locale: Locale
  ui: UiLocale
  accessByExam: AccessByExamItem[]
}) {
  const byExam = [...(stats?.byExamType ?? [])].sort(
    (a, b) =>
      (b.testsCount + (b.inProgressCount ?? 0)) - (a.testsCount + (a.inProgressCount ?? 0)),
  )
  const totalStarted = (stats?.completedTests ?? 0) + (stats?.inProgressSessionsCount ?? 0)
  const completionPct = totalStarted
    ? Math.round(((stats?.completedTests ?? 0) / totalStarted) * 100)
    : 0

  return (
    <View style={styles.statsDash}>
      <ExamStatsPanel items={byExam} loading={loading} locale={locale} ui={ui} />
      <View style={styles.statsCol}>
        <ActivityPanel
          stats={stats}
          loading={loading}
          totalStarted={totalStarted}
          completionPct={completionPct}
          ui={ui}
        />
        <TrendPanel items={byExam} loading={loading} locale={locale} ui={ui} />
        <AccessPanel items={accessByExam} loading={false} ui={ui} />
      </View>
    </View>
  )
}

function ExamStatsPanel({
  items,
  loading,
  locale,
  ui,
}: {
  items: UserExamStats[]
  loading: boolean
  locale: Locale
  ui: UiLocale
}) {
  const { colors } = useAppTheme()
  return (
    <Card padded={false}>
      <View style={[styles.cardHeadRow, styles.cardHeadPad]}>
        <View style={styles.rowCenter}>
          <MaterialCommunityIcons name="chart-bar" size={18} color={colors.foreground} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("homeExamStatsTitle", ui)}</Text>
        </View>
        <Pressable onPress={() => router.push("/dashboard/exams")} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.foreground }]}>{t("homeCatalogLink", ui)}</Text>
          <MaterialCommunityIcons name="arrow-right" size={14} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={styles.cardBody}>
        {loading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} h={112} colors={colors} style={{ width: "100%" }} />
            ))}
          </View>
        ) : items.length === 0 ? (
          <EmptyDashboard
            icon="chart-bar"
            title={t("homeExamStatsEmptyTitle", ui)}
            text={t("homeExamStatsEmptyText", ui)}
          />
        ) : (
          <View>
            {items.map((item) => {
              const name = localize(item.examType?.name, locale, item.examSlug || t("examFallbackName", ui))
              const avg = clampPct(item.averageScore)
              const correct = clampPct(item.averageCorrectPercent)
              const attempts = item.testsCount + (item.inProgressCount ?? 0)
              return (
                <View
                  key={item.examTypeId}
                  style={[styles.examRow, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.examRowMain}>
                    <View style={styles.examTitleRow}>
                      <Text style={[styles.examName, { color: colors.foreground }]} numberOfLines={1}>
                        {name}
                      </Text>
                      {item.examSlug ? (
                        <Badge variant="secondary">{item.examSlug.toUpperCase()}</Badge>
                      ) : null}
                    </View>
                    <View style={styles.examMiniGrid}>
                      <MiniMetric label={t("homeAttempts", ui)} value={attempts} />
                      <MiniMetric label={t("homeFinished", ui)} value={item.completedCount ?? item.testsCount} />
                      <MiniMetric label={t("homeBestScores", ui)} value={formatBestPoints(item)} />
                      <MiniMetric label={t("homeAvgTime", ui)} value={formatDuration(item.averageDurationSecs, ui)} />
                    </View>
                  </View>
                  <View style={styles.examProgressCol}>
                    <ProgressLine label={t("homeAvgResult", ui)} value={avg} suffix="%" colors={colors} />
                    <ProgressLine label={t("homeAccuracy", ui)} value={correct} suffix="%" colors={colors} />
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </Card>
  )
}

function ProgressLine({
  label,
  value,
  suffix,
  colors,
}: {
  label: string
  value: number
  suffix: string
  colors: { mutedForeground: string; foreground: string; secondary: string }
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={styles.progressLabels}>
        <Text style={[styles.progressLabelLeft, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.progressLabelRight, { color: colors.foreground }]}>
          {value}
          {suffix}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
        <View style={[styles.progressFill, { width: `${value}%`, backgroundColor: colors.foreground }]} />
      </View>
    </View>
  )
}

function ActivityPanel({
  stats,
  loading,
  totalStarted,
  completionPct,
  ui,
}: {
  stats?: UserStats
  loading: boolean
  totalStarted: number
  completionPct: number
  ui: UiLocale
}) {
  const { colors } = useAppTheme()
  return (
    <Card>
      <View style={styles.rowCenter}>
        <MaterialCommunityIcons name="chart-line" size={18} color={colors.foreground} />
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("homeActivityTitle", ui)}</Text>
      </View>
      <View style={{ marginTop: 12 }}>
        {loading ? (
          <View style={{ gap: 10 }}>
            <SkeletonBlock h={28} w={96} colors={colors} />
            <SkeletonBlock h={8} colors={colors} style={{ width: "100%" }} />
            <SkeletonBlock h={56} colors={colors} style={{ width: "100%" }} />
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View>
              <View style={styles.progressLabels}>
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{t("homeCompletionRate", ui)}</Text>
                <Text style={{ fontSize: 22, fontFamily: fonts.sansSemi, color: colors.foreground }}>
                  {completionPct}%
                </Text>
              </View>
              <View style={[styles.progressTrack, { marginTop: 8, backgroundColor: colors.secondary }]}>
                <View
                  style={[styles.progressFill, { width: `${completionPct}%`, backgroundColor: colors.foreground }]}
                />
              </View>
            </View>
            <View style={styles.actThree}>
              <MiniMetricIcon label={t("homeStarted", ui)} value={totalStarted} icon="format-list-checks" />
              <MiniMetricIcon label={t("homeCompleted", ui)} value={stats?.completedTests ?? 0} icon="check-circle" />
              <MiniMetricIcon
                label={t("homeInProgress", ui)}
                value={stats?.inProgressSessionsCount ?? 0}
                icon="clock-outline"
              />
            </View>
          </View>
        )}
      </View>
    </Card>
  )
}

function MiniMetricIcon({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]
}) {
  const { colors } = useAppTheme()
  return (
    <View style={[styles.miniMetric, { borderColor: colors.border, backgroundColor: colors.secondary, flex: 1 }]}>
      <View style={styles.rowCenter}>
        <MaterialCommunityIcons name={icon} size={14} color={colors.mutedForeground} />
        <Text style={[styles.miniMetricLabel, { color: colors.mutedForeground, marginLeft: 4 }]}>{label}</Text>
      </View>
      <Text style={[styles.miniMetricValue, { color: colors.foreground, marginTop: 6 }]}>{value}</Text>
    </View>
  )
}

function TrendPanel({
  items,
  loading,
  locale,
  ui,
}: {
  items: UserExamStats[]
  loading: boolean
  locale: Locale
  ui: UiLocale
}) {
  const { colors } = useAppTheme()
  const { width: winW } = useWindowDimensions()
  const innerApprox = Math.max(260, winW - 72)
  const BAR_SLOT = 14
  const BAR_GAP = 4
  /** sparkRow paddingHorizontal 8 + 8 */
  const BAR_ROW_PAD_X = 16

  const withScores = items.filter((item) => (item.recentScores?.length ?? 0) > 0).slice(0, 3)

  return (
    <Card>
      <View style={styles.rowCenter}>
        <MaterialCommunityIcons name="speedometer" size={18} color={colors.foreground} />
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("homeTrendResultsTitle", ui)}</Text>
      </View>
      <View style={{ marginTop: 12 }}>
        {loading ? (
          <View style={{ gap: 10 }}>
            <SkeletonBlock h={56} colors={colors} style={{ width: "100%" }} />
            <SkeletonBlock h={56} colors={colors} style={{ width: "100%" }} />
          </View>
        ) : withScores.length === 0 ? (
          <EmptyDashboard
            icon="speedometer"
            title={t("homeTrendEmptyTitle", ui)}
            text={t("homeTrendEmptyText", ui)}
          />
        ) : (
          <View style={{ gap: 16 }}>
            {withScores.map((item) => {
              const scores = item.recentScores ?? []
              const barsWidth =
                scores.length * BAR_SLOT + Math.max(0, scores.length - 1) * BAR_GAP
              const sparkW = Math.max(innerApprox, BAR_ROW_PAD_X + barsWidth)

              return (
                <View key={item.examTypeId} style={{ gap: 8 }}>
                  <View style={styles.progressLabels}>
                    <Text style={[styles.trendName, { color: colors.foreground }]} numberOfLines={1}>
                      {localize(item.examType?.name, locale, item.examSlug || t("examFallbackName", ui))}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                      {scores.at(-1) ?? 0}%
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={scores.length > 10}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View
                      style={[
                        styles.sparkRow,
                        {
                          width: sparkW,
                          borderColor: colors.border,
                          backgroundColor: `${colors.secondary}66`,
                        },
                      ]}
                    >
                      {scores.map((score, idx) => {
                        const barH = Math.max(6, Math.round((clampPct(score) / 100) * 52))
                        return (
                          <View
                            key={`${item.examTypeId}-${idx}`}
                            style={{ width: BAR_SLOT, justifyContent: "flex-end" }}
                          >
                            <View
                              style={{
                                height: barH,
                                borderRadius: 3,
                                backgroundColor: `${colors.foreground}CC`,
                              }}
                            />
                          </View>
                        )
                      })}
                    </View>
                  </ScrollView>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </Card>
  )
}

function AccessPanel({ items, loading, ui }: { items: AccessByExamItem[]; loading: boolean; ui: UiLocale }) {
  const { colors } = useAppTheme()
  const visible = items.slice(0, 4)

  return (
    <Card>
      <View style={styles.rowCenter}>
        <MaterialCommunityIcons name="shield-check" size={18} color={colors.foreground} />
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("homeAccessTitle", ui)}</Text>
      </View>
      <View style={{ marginTop: 12 }}>
        {loading ? (
          <SkeletonBlock h={72} colors={colors} style={{ width: "100%" }} />
        ) : visible.length === 0 ? (
          <EmptyDashboard
            icon="shield-check"
            title={t("homeAccessEmptyTitle", ui)}
            text={t("homeAccessEmptyText", ui)}
          />
        ) : (
          <View>
            {visible.map((item, idx) => (
              <View
                key={item.examTypeId}
                style={[
                  styles.accessRow,
                  { borderBottomColor: colors.border },
                  idx === visible.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.accessSlug, { color: colors.foreground }]} numberOfLines={1}>
                    {(item.examSlug || "exam").toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{formatAccessLine(item, ui)}</Text>
                </View>
                <Badge variant={item.hasAccess ? "default" : "outline"}>
                  {item.hasAccess ? t("homeAccessYes", ui) : accessReasonLabel(item.reasonCode, ui)}
                </Badge>
              </View>
            ))}
          </View>
        )}
      </View>
    </Card>
  )
}

function EmptyDashboard({
  icon,
  title,
  text,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]
  title: string
  text: string
}) {
  const { colors } = useAppTheme()
  return (
    <View style={styles.emptyDash}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.secondary }]}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  )
}

function EmptySessions({ onPress, ui }: { onPress: () => void; ui: UiLocale }) {
  const { colors } = useAppTheme()
  return (
    <View style={styles.emptySess}>
      <View style={[styles.emptySessIcon, { backgroundColor: colors.secondary }]}>
        <MaterialCommunityIcons name="book-open-page-variant" size={22} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("dashEmptySessionsTitle", ui)}</Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("dashEmptySessionsText", ui)}</Text>
      <Button onPress={onPress}>{t("homeTakeTrial", ui)}</Button>
    </View>
  )
}

function StatusBadge({ status, ui }: { status: SessionListItem["status"]; ui: UiLocale }) {
  const map: Record<
    SessionListItem["status"],
    { labelKey: string; bg: string; fg: string; border: string }
  > = {
    in_progress: { labelKey: "sessionInProgress", bg: "#FEF3C7", fg: "#78350F", border: "#FDE68A" },
    completed: { labelKey: "sessionCompleted", bg: "#D1FAE5", fg: "#064E3B", border: "#A7F3D0" },
    timed_out: { labelKey: "sessionTimedOut", bg: "#FFE4E6", fg: "#881337", border: "#FECDD3" },
    abandoned: { labelKey: "sessionAbandoned", bg: "#F3F4F6", fg: "#6B7280", border: "#E5E7EB" },
  }
  const v = map[status]
  return (
    <View style={[styles.statusBadge, { backgroundColor: v.bg, borderColor: v.border }]}>
      <Text style={[styles.statusBadgeText, { color: v.fg }]}>{t(v.labelKey, ui)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 24, paddingBottom: 120 },
  heroCard: { overflow: "hidden" },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  heroBadgeText: { fontSize: 11, fontWeight: "600" },
  heroTop: { gap: 16 },
  heroTextCol: { gap: 10 },
  heroTitle: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 40 },
  heroSub: { fontSize: 15, lineHeight: 22, maxWidth: 520 },
  heroLimits: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  heroLimitsThree: {},
  heroLimitBox: {
    flexGrow: 1,
    minWidth: "28%",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroLimitLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  heroLimitValue: { marginTop: 4, fontSize: 14, fontWeight: "600" },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  heroCtaText: { fontSize: 15, fontFamily: fonts.sansSemi },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "47%", flexGrow: 1, minWidth: 148 },
  statCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  statLabel: { fontSize: 11, fontWeight: "600", flex: 1, paddingRight: 8 },
  statIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 28, fontFamily: fonts.sansSemi },
  cardHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardHeadPad: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  cardTitle: { fontSize: 16, fontFamily: fonts.sansSemi },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { fontSize: 13, fontWeight: "600" },
  sessSpinner: { paddingVertical: 28, alignItems: "center" },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sessionMeta: { flex: 1, minWidth: 0 },
  sessionTitle: { fontSize: 15, fontFamily: fonts.sansSemi },
  sessionDate: { fontSize: 11, marginTop: 4 },
  sessionRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  sessionScore: { fontSize: 13, fontFamily: fonts.sansSemi },
  bottomGrid: { gap: 24 },
  bottomMain: { flex: 1 },
  bottomAside: {},
  asideBtns: { gap: 10 },
  sideCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sideCtaGhost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  sideCtaText: { fontSize: 15, fontFamily: fonts.sansSemi },
  chartSplit: { gap: 16 },
  chartMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  miniMetric: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: "30%",
    flexGrow: 1,
  },
  miniMetricLabel: { fontSize: 11 },
  miniMetricValue: { marginTop: 6, fontSize: 13, fontFamily: fonts.sansSemi },
  statsDash: { gap: 24 },
  statsCol: { gap: 24 },
  examRow: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  examRowMain: { gap: 10 },
  examTitleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  examName: { fontSize: 15, fontFamily: fonts.sansSemi, flexShrink: 1 },
  examMiniGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  examProgressCol: { gap: 10 },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 4,
  },
  progressLabelLeft: { fontSize: 11 },
  progressLabelRight: { fontSize: 11, fontFamily: fonts.sansSemi },
  progressTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  actThree: { flexDirection: "row", gap: 8 },
  trendName: { fontSize: 13, fontFamily: fonts.sansSemi, flex: 1 },
  sparkRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 64,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accessSlug: { fontSize: 13, fontFamily: fonts.sansSemi },
  emptyDash: { alignItems: "center", paddingVertical: 22, gap: 8 },
  emptyIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 14, fontFamily: fonts.sansSemi },
  emptyText: { fontSize: 12, textAlign: "center", maxWidth: 280, lineHeight: 18 },
  emptySess: { alignItems: "center", paddingVertical: 28, gap: 10 },
  emptySessIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  sessPager: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  sessPagerMeta: { fontSize: 13, fontVariant: ["tabular-nums"] },
  sessPagerBtns: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  sessPagerBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  sessPagerPage: {
    fontSize: 15,
    fontFamily: fonts.sansSemi,
    fontVariant: ["tabular-nums"],
    minWidth: 56,
    textAlign: "center",
  },
})
