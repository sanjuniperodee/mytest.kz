import { MaterialCommunityIcons } from "@expo/vector-icons"
import useSWR from "swr"
import { useMemo, useState } from "react"
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { resolveMediaUrl } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { LeaderboardEntry } from "@/lib/api/types"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"
import { t, useUiLocale, type UiLocale } from "@/lib/i18n/ui"

const LIMITS = [10, 50, 100] as const

interface NormalizedEntry {
  rank: number
  userId: string
  name: string
  username: string | null
  avatarUrl: string | null
  score: number
  maxScore: number | null
  totalTests: number | null
}

function pickNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      return Number(v)
    }
  }
  return null
}

function normalizeEntry(entry: LeaderboardEntry, idx: number, locale: Locale, ui: UiLocale): NormalizedEntry {
  const u = entry.user || {}

  const fullName =
    localize(entry.fullName, locale) ||
    localize(u.fullName, locale) ||
    localize(entry.name, locale) ||
    localize(u.name, locale) ||
    localize(entry.displayName, locale) ||
    localize(u.displayName, locale)

  const firstName = localize(entry.firstName, locale) || localize(u.firstName, locale)
  const lastName = localize(entry.lastName, locale) || localize(u.lastName, locale)
  const composedName = [firstName, lastName].filter(Boolean).join(" ").trim()

  const username = entry.username ?? u.username ?? null
  const phone = entry.phone ?? u.phone ?? null

  const maskedPhone = phone
    ? phone.length > 6
      ? `${phone.slice(0, 4)}•••${phone.slice(-2)}`
      : phone
    : null

  const name =
    fullName ||
    composedName ||
    username ||
    maskedPhone ||
    t("lbAnonymous", ui)

  const score =
    pickNumber(
      entry.rawScore,
      entry.bestRawScore,
      entry.totalScore,
      entry.points,
      entry.value,
      entry.bestScore,
      entry.total,
      entry.score,
    ) ?? 0
  const maxScore = pickNumber(entry.maxScore, entry.bestMaxScore)

  const totalTests = pickNumber(
    entry.totalTests,
    entry.testsCount,
    entry.attempts,
    entry.attemptsCount,
  )

  const avatarUrl = entry.avatarUrl || u.avatarUrl || null

  const userId =
    entry.userId ||
    u.id ||
    (entry as Record<string, unknown>).id?.toString() ||
    `entry-${idx}`

  const rank = pickNumber(entry.rank, entry.position) ?? idx + 1

  return {
    rank,
    userId: String(userId),
    name,
    username,
    avatarUrl,
    score,
    maxScore,
    totalTests,
  }
}

function formatPoints(entry: Pick<NormalizedEntry, "score" | "maxScore">): string {
  return entry.maxScore != null && entry.maxScore > 0
    ? `${entry.score}/${entry.maxScore}`
    : String(entry.score)
}

export function LeaderboardView() {
  const { colors, resolved } = useAppTheme()
  const { width } = useWindowDimensions()
  const { user } = useAuth()
  const { locale: ui } = useUiLocale()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(50)

  const { data, isLoading } = useSWR<
    | { items?: LeaderboardEntry[]; me?: LeaderboardEntry | null }
    | LeaderboardEntry[]
    | { data?: LeaderboardEntry[]; me?: LeaderboardEntry | null }
  >(`/leaderboard/ent?limit=${limit}`)

  const rawItems: LeaderboardEntry[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "items" in data && Array.isArray(data.items)
      ? data.items
      : data && typeof data === "object" && "data" in data && Array.isArray(data.data)
        ? data.data
        : []

  const items = useMemo(
    () => rawItems.map((e, i) => normalizeEntry(e, i, locale, ui)),
    [rawItems, locale, ui],
  )

  const responseMe =
    data && !Array.isArray(data) && "me" in data && data.me
      ? normalizeEntry(data.me as LeaderboardEntry, rawItems.length, locale, ui)
      : null
  const myRank = items.find((it) => it.userId === user?.id) || responseMe
  const podium = items.slice(0, 3)
  const rest = items.slice(3)
  const podiumOrder = width >= 640 ? ([1, 0, 2] as const) : ([0, 1, 2] as const)

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.secondary }]}>
      <View style={[styles.pill, { backgroundColor: `${colors.accent}22` }]}>
        <MaterialCommunityIcons name="star-four-points-small" size={14} color={colors.accent} />
        <Text style={[styles.pillText, { color: colors.accent }]}>{t("lbPill", ui)}</Text>
      </View>
      <Text style={[styles.h1, { color: colors.foreground }]}>{t("lbTitle", ui)}</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t("lbSub", ui)}</Text>

      <View style={styles.toolbar}>
        <View style={[styles.limits, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {LIMITS.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLimit(l)}
              style={[
                styles.limitChip,
                {
                  backgroundColor: limit === l ? colors.foreground : "transparent",
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: limit === l ? colors.background : colors.foreground,
                }}
              >
                {`${t("lbTopPrefix", ui)}${l}`}
              </Text>
            </Pressable>
          ))}
        </View>
        {myRank ? (
          <Badge variant="outline" style={{ backgroundColor: colors.secondary }}>
            {`${t("lbRankPrefix", ui)}#${myRank.rank} · ${formatPoints(myRank)}${t("lbPointsSuffix", ui)}`}
          </Badge>
        ) : null}
      </View>

      {!isLoading && podium.length > 0 ? (
        <View style={[styles.podiumRow, width >= 640 && styles.podiumRowWide]}>
          {podiumOrder.map((orderIdx) => {
            const entry = podium[orderIdx]
            if (!entry) return <View key={orderIdx} style={{ flex: 1 }} />
            return (
              <PodiumCard
                key={entry.userId}
                entry={entry}
                highlight={entry.userId === user?.id}
                scaleCenter={width >= 640 && entry.rank === 1}
                resolved={resolved}
                ui={ui}
              />
            )
          })}
        </View>
      ) : null}

      <Card padded={false}>
        <View style={[styles.listHead, { borderBottomColor: colors.border }]}>
          <Text style={[styles.listTitle, { color: colors.foreground }]}>{t("lbAllParticipants", ui)}</Text>
        </View>
        {isLoading ? (
          <View>
            {Array.from({ length: 8 }).map((_, i) => (
              <View
                key={i}
                style={[styles.skelRow, { borderBottomColor: colors.border }]}
              >
                <View style={[styles.avatarSkel, { backgroundColor: colors.secondary }]} />
                <View style={[styles.skelLine, { backgroundColor: colors.secondary, flex: 1 }]} />
                <View style={[styles.skelLine, { backgroundColor: colors.secondary, width: 48 }]} />
              </View>
            ))}
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <MaterialCommunityIcons name="trophy" size={22} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("lbNoResults", ui)}</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {t("lbNoResultsHint", ui)}
            </Text>
          </View>
        ) : (
          <>
            {rest.map((item) => (
              <LeaderRow key={item.userId} entry={item} highlight={item.userId === user?.id} ui={ui} />
            ))}
            {rest.length === 0 && podium.length > 0 ? (
              <Text style={[styles.onlyTop, { color: colors.mutedForeground }]}>
                {t("lbOnlyTop3", ui)}
              </Text>
            ) : null}
          </>
        )}
      </Card>
    </ScrollView>
  )
}

function PodiumCard({
  entry,
  highlight,
  scaleCenter,
  resolved,
  ui,
}: {
  entry: NormalizedEntry
  highlight?: boolean
  scaleCenter?: boolean
  resolved: "light" | "dark"
  ui: UiLocale
}) {
  const { colors } = useAppTheme()
  const initials = entry.name.slice(0, 2).toUpperCase()
  const uri = resolveMediaUrl(entry.avatarUrl)

  const meta =
    entry.rank === 1
      ? {
          icon: "crown" as const,
          label: t("lbPlace1", ui),
          accent: "#F59E0B",
          ring: "#FDE68A",
          bg: resolved === "dark" ? "#422006" : "#FFFBEB",
        }
      : entry.rank === 2
        ? {
            icon: "trophy" as const,
            label: t("lbPlace2", ui),
            accent: "#71717A",
            ring: "#E4E4E7",
            bg: resolved === "dark" ? "#27272A" : "#FAFAFA",
          }
        : {
            icon: "medal" as const,
            label: t("lbPlace3", ui),
            accent: "#EA580C",
            ring: "#FED7AA",
            bg: resolved === "dark" ? "#431407" : "#FFF7ED",
          }

  return (
    <Card
      style={[
        styles.podiumCard,
        highlight && { borderColor: colors.foreground },
        scaleCenter && styles.podiumCenter,
      ]}
    >
      <View style={styles.podiumMetaRow}>
        <MaterialCommunityIcons name={meta.icon} size={20} color={meta.accent} />
        <Text style={[styles.podiumLabel, { color: colors.mutedForeground }]}>{meta.label}</Text>
      </View>
      <View style={[styles.podiumAvatar, { borderColor: meta.ring, backgroundColor: meta.bg }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.podiumImg} />
        ) : (
          <Text style={[styles.podiumInitials, { color: colors.foreground }]}>{initials}</Text>
        )}
      </View>
      <Text style={[styles.podiumName, { color: colors.foreground }]} numberOfLines={1}>
        {entry.name}
      </Text>
      <Text style={[styles.podiumPts, { color: colors.foreground }]}>{formatPoints(entry)}</Text>
      <Text style={[styles.podiumPtsLbl, { color: colors.mutedForeground }]}>{t("lbPointsShort", ui)}</Text>
      {entry.totalTests != null ? (
        <Text style={[styles.podiumTests, { color: colors.mutedForeground }]}>
          {entry.totalTests} {t("lbTests", ui)}
        </Text>
      ) : null}
    </Card>
  )
}

function LeaderRow({ entry, highlight, ui }: { entry: NormalizedEntry; highlight?: boolean; ui: UiLocale }) {
  const { colors } = useAppTheme()
  const initials = entry.name.slice(0, 2).toUpperCase()
  const uri = resolveMediaUrl(entry.avatarUrl)

  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: colors.border },
        highlight && { backgroundColor: colors.secondary },
      ]}
    >
      <Text style={[styles.rankCol, { color: colors.mutedForeground }]}>{entry.rank}</Text>
      <View style={[styles.rowAvatar, { backgroundColor: colors.secondary }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.rowImg} />
        ) : (
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>{initials}</Text>
        )}
      </View>
      <View style={styles.rowMid}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
            {entry.name}
          </Text>
          {highlight ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{t("lbYou", ui)}</Text>
          ) : null}
        </View>
        {entry.totalTests != null ? (
          <Text style={[styles.rowTests, { color: colors.mutedForeground }]}>
            {entry.totalTests} {t("lbTests", ui)}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowPts}>
        <Text style={[styles.rowPtsVal, { color: colors.foreground }]}>{formatPoints(entry)}</Text>
        <Text style={[styles.rowPtsLbl, { color: colors.mutedForeground }]}>{t("lbPointsShort", ui)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 20, paddingBottom: 120 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { fontSize: 11, fontWeight: "600" },
  h1: { fontSize: 30, fontFamily: fonts.sansSemi, letterSpacing: -0.5 },
  sub: { fontSize: 15, lineHeight: 22 },
  toolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  limits: { flexDirection: "row", borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 2 },
  limitChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  podiumRow: { gap: 12 },
  podiumRowWide: { flexDirection: "row", alignItems: "flex-end" },
  podiumCard: { flex: 1, alignItems: "center", padding: 16, gap: 10, minWidth: 100 },
  podiumCenter: { transform: [{ scale: 1.04 }] },
  podiumMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  podiumLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  podiumAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  podiumImg: { width: 56, height: 56, borderRadius: 28 },
  podiumInitials: { fontSize: 20, fontFamily: fonts.sansSemi },
  podiumName: { fontSize: 13, fontFamily: fonts.sansSemi, maxWidth: "100%" },
  podiumPts: { fontSize: 26, fontFamily: fonts.sansSemi },
  podiumPtsLbl: { fontSize: 11 },
  podiumTests: { fontSize: 11 },
  listHead: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  listTitle: { fontSize: 16, fontFamily: fonts.sansSemi },
  skelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarSkel: { width: 36, height: 36, borderRadius: 18 },
  skelLine: { height: 14, borderRadius: 6 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 15, fontFamily: fonts.sansSemi },
  emptySub: { fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
  onlyTop: { textAlign: "center", paddingVertical: 22, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankCol: { width: 28, textAlign: "center", fontSize: 13, fontFamily: fonts.sansSemi },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  rowImg: { width: 36, height: 36 },
  rowMid: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontFamily: fonts.sansSemi },
  rowTests: { fontSize: 11, marginTop: 2 },
  rowPts: { alignItems: "flex-end" },
  rowPtsVal: { fontSize: 15, fontFamily: fonts.sansSemi },
  rowPtsLbl: { fontSize: 11 },
})
