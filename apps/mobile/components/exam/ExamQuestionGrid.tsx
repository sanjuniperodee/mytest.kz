import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import type { FlatSessionQuestion } from "@/lib/api/test-session"
import type { ThemeColors } from "@/lib/theme/colors"
import { fonts } from "@/lib/theme/fonts"

const COLS = 6
const GAP = 6

function buildGroups(flat: FlatSessionQuestion[]) {
  const groups: { title: string; items: { idx: number; q: FlatSessionQuestion }[] }[] = []
  flat.forEach((q, idx) => {
    const title = q.sectionTitle || ""
    const last = groups[groups.length - 1]
    if (!last || last.title !== title) groups.push({ title, items: [{ idx, q }] })
    else last.items.push({ idx, q })
  })
  return groups
}

export function ExamQuestionGrid({
  flat,
  answers,
  activeIdx,
  onSelect,
  answered,
  total,
  colors,
  gridInnerWidth,
}: {
  flat: FlatSessionQuestion[]
  answers: Record<string, string[]>
  activeIdx: number
  onSelect: (i: number) => void
  answered: number
  total: number
  colors: ThemeColors
  /** Width available for the 6-column grid (after horizontal padding). */
  gridInnerWidth?: number
}) {
  const { width: winW } = useWindowDimensions()
  const groups = useMemo(() => buildGroups(flat), [flat])
  const innerW = gridInnerWidth ?? Math.max(280, winW - 32)
  const cell = (innerW - GAP * (COLS - 1)) / COLS

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.cardLbl, { color: colors.mutedForeground }]}>Прогресс</Text>
        <Text style={[styles.cardNum, { color: colors.foreground }]}>
          {answered}/{total}
        </Text>
      </View>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        {groups.map((g, gi) => (
          <View key={gi} style={gi > 0 ? styles.groupSpaced : undefined}>
            {g.title ? (
              <Text style={[styles.secLbl, { color: colors.mutedForeground }]}>{g.title}</Text>
            ) : null}
            <View style={[styles.grid, { gap: GAP }]}>
              {g.items.map(({ idx, q }) => {
                const isAnswered = (answers[q.id] || []).length > 0
                const isActive = idx === activeIdx
                const bg = isActive
                  ? colors.foreground
                  : isAnswered
                    ? colors.secondary
                    : colors.background
                const fg = isActive ? colors.background : isAnswered ? colors.foreground : colors.mutedForeground
                const bd = isActive ? colors.foreground : colors.border
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => onSelect(idx)}
                    style={[
                      styles.cell,
                      {
                        width: cell,
                        height: 36,
                        backgroundColor: bg,
                        borderColor: bd,
                      },
                    ]}
                  >
                    <Text style={[styles.cellTxt, { color: fg }]}>{idx + 1}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  card: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  cardLbl: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardNum: {
    marginTop: 4,
    fontSize: 22,
    fontFamily: fonts.sansSemi,
    fontVariant: ["tabular-nums"],
  },
  secLbl: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  groupSpaced: { marginTop: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  cellTxt: {
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
})
