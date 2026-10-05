import { MaterialCommunityIcons } from "@expo/vector-icons"
import { StyleSheet, Text, View } from "react-native"
import type { AdmissionChanceLevel } from "@/lib/api/types"
import { useTr } from "@/lib/i18n/use-tr"
import { accentPalette } from "@/lib/theme/accents"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

type Tr = (ru: string, kk: string) => string

/** Russian plural: 1 грант, 2 гранта, 5 грантов. */
export function ruPlural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function grantsLabel(n: number, tr: Tr) {
  return tr(`${n} ${ruPlural(n, "грант", "гранта", "грантов")}`, `${n} грант`)
}

export function chanceLabel(level: AdmissionChanceLevel, tr: Tr, passesEntThresholds = true) {
  if (!passesEntThresholds) return tr("Не пройден порог ЕНТ", "ҰБТ шегінен өтпеді")
  switch (level) {
    case "HIGH":
      return tr("Высокий шанс", "Мүмкіндік жоғары")
    case "MEDIUM":
      return tr("На грани", "Шекарада")
    case "LOW":
      return tr("Немного не хватает", "Сәл жетпейді")
    default:
      return tr("Пока не хватает", "Әзірге жетпейді")
  }
}

const TINT: Record<AdmissionChanceLevel, "emerald" | "amber" | "orange" | "rose"> = {
  HIGH: "emerald",
  MEDIUM: "amber",
  LOW: "orange",
  NONE: "rose",
}

export function useChanceTint(level: AdmissionChanceLevel) {
  const { resolved } = useAppTheme()
  return accentPalette(resolved)[TINT[level]]
}

export function ChanceBadge({ level, passesEntThresholds = true }: { level: AdmissionChanceLevel; passesEntThresholds?: boolean }) {
  const tr = useTr()
  const tint = useChanceTint(passesEntThresholds ? level : "NONE")
  return (
    <View style={[styles.badge, { backgroundColor: tint.bg }]}>
      <Text style={[styles.badgeText, { color: tint.fg }]}>{chanceLabel(level, tr, passesEntThresholds)}</Text>
    </View>
  )
}

/** "2025: 98 (+2)" — rising cutoff is red (harder), falling is green. */
export function CutoffTrend({
  current,
  previous,
  previousYear,
}: {
  current: number
  previous: number | null | undefined
  previousYear: number | null | undefined
}) {
  const { colors, resolved } = useAppTheme()
  if (previous == null) return null
  const diff = current - previous
  const palette = accentPalette(resolved)
  const color = diff > 0 ? palette.rose.fg : diff < 0 ? palette.emerald.fg : colors.mutedForeground
  return (
    <View style={styles.trend}>
      <MaterialCommunityIcons
        name={diff > 0 ? "arrow-top-right" : diff < 0 ? "arrow-bottom-right" : "arrow-right"}
        size={12}
        color={color}
      />
      <Text style={[styles.trendText, { color }]}>
        {previousYear ? `${previousYear}: ${previous}` : previous}
        {diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff})` : ""}
      </Text>
    </View>
  )
}

export function ChanceLegend() {
  const tr = useTr()
  const { colors } = useAppTheme()
  const rows: [AdmissionChanceLevel, string][] = [
    ["HIGH", tr("балл не ниже среднего у получивших грант", "балл грант алғандардың орташасынан төмен емес")],
    ["MEDIUM", tr("выше проходного, но ниже среднего", "өту балынан жоғары, орташадан төмен")],
    ["LOW", tr("до 5 баллов ниже проходного", "өту балынан 5 балға дейін төмен")],
    ["NONE", tr("ниже проходного больше чем на 5 баллов", "өту балынан 5 балдан артық төмен")],
  ]
  return (
    <View style={{ gap: 6 }}>
      {rows.map(([level, text]) => (
        <View key={level} style={styles.legendRow}>
          <ChanceBadge level={level} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{text}</Text>
        </View>
      ))}
      <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
        {tr(
          "Проходной балл каждый год меняется на несколько баллов — это ориентир, не гарантия.",
          "Өту балы жыл сайын бірнеше балға өзгереді — бұл кепілдік емес, бағдар.",
        )}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontFamily: fonts.sansSemi },
  trend: { flexDirection: "row", alignItems: "center", gap: 2 },
  trendText: { fontSize: 12 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  legendText: { fontSize: 12, lineHeight: 17, flexShrink: 1 },
})
