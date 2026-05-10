import { MaterialCommunityIcons } from "@expo/vector-icons"
import useSWR from "swr"
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { router } from "expo-router"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { ExamType } from "@/lib/api/types"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"
import { t, useUiLocale } from "@/lib/i18n/ui"

function SkeletonCard({ width }: { width: number }) {
  const { colors } = useAppTheme()
  return (
    <View style={[styles.skeletonCard, { width, backgroundColor: colors.secondary }]} />
  )
}

export function ExamsCatalogView() {
  const { colors } = useAppTheme()
  const { width: winW } = useWindowDimensions()
  const { locale: ui } = useUiLocale()
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const { data, isLoading } = useSWR<ExamType[]>("/exams/types")
  const items = Array.isArray(data) ? data : []

  const pad = 16
  const gap = 16
  const usable = Math.max(0, winW - pad * 2)
  const cols = winW >= 1024 ? 3 : winW >= 640 ? 2 : 1
  const tileW = cols > 1 ? (usable - gap * (cols - 1)) / cols : usable

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.secondary }]}>
      <View style={styles.hero}>
        <View style={[styles.pill, { backgroundColor: `${colors.accent}22` }]}>
          <MaterialCommunityIcons name="star-four-points-small" size={14} color={colors.accent} />
          <Text style={[styles.pillText, { color: colors.accent }]}>{t("examsPill", ui)}</Text>
        </View>
        <Text style={[styles.h1, { color: colors.foreground }]}>{t("examsTitle", ui)}</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t("examsLead", ui)}</Text>
      </View>

      {isLoading ? (
        <View style={[styles.grid, { gap }]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} width={tileW} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <Card>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("examsEmpty", ui)}</Text>
        </Card>
      ) : (
        <View style={[styles.grid, { gap }]}>
          {items.map((ex) => {
            const name = localize(ex.name, locale, t("examFallbackName", ui))
            const description = localize(ex.description, locale)
            return (
              <Pressable
                key={ex.id}
                onPress={() => router.push(`/dashboard/exams/${ex.id}`)}
                style={({ pressed }) => [{ width: tileW }, pressed && styles.cardPressed]}
              >
                <Card padded={false} style={styles.examCard}>
                  <View style={styles.cardHead}>
                    <View style={[styles.iconBox, { backgroundColor: colors.foreground }]}>
                      <MaterialCommunityIcons name="book-open-page-variant" size={22} color={colors.background} />
                    </View>
                    <Badge variant="secondary">
                      <Text style={styles.slugBadge}>{(ex.slug || ex.code || "exam").toUpperCase()}</Text>
                    </Badge>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {name}
                    </Text>
                    {description ? (
                      <Text
                        style={[styles.cardDesc, { color: colors.mutedForeground }]}
                        numberOfLines={2}
                      >
                        {description}
                      </Text>
                    ) : null}
                    <View style={styles.openRow}>
                      <Text style={[styles.openText, { color: `${colors.foreground}CC` }]}>{t("examsOpen", ui)}</Text>
                      <MaterialCommunityIcons name="arrow-right" size={16} color={`${colors.foreground}CC`} />
                    </View>
                  </View>
                </Card>
              </Pressable>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 24, paddingBottom: 120 },
  hero: { gap: 8 },
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
  h1: { fontSize: 30, fontFamily: fonts.sansSemi, letterSpacing: -0.5, marginTop: 4 },
  sub: { fontSize: 15, lineHeight: 22, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  skeletonCard: {
    height: 176,
    borderRadius: 14,
  },
  examCard: {
    width: "100%",
    minHeight: 220,
  },
  cardPressed: { opacity: 0.92 },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  slugBadge: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    letterSpacing: 0.5,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
    flex: 1,
  },
  cardTitle: { fontSize: 17, fontFamily: fonts.sansSemi, lineHeight: 22 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  openRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: "auto", paddingTop: 4 },
  openText: { fontSize: 14, fontFamily: fonts.sansSemi },
  emptyText: { textAlign: "center", paddingVertical: 40, fontSize: 15 },
})
