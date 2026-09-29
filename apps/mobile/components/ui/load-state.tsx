import { StyleSheet, Text, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useTr } from "@/lib/i18n/use-tr"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

/** Loading skeleton or an error with a retry button; renders nothing when idle. */
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading?: boolean
  error?: unknown
  retry: () => void
}) {
  const { colors } = useAppTheme()
  const tr = useTr()
  if (error) {
    return (
      <View
        accessibilityRole="alert"
        style={[styles.error, { borderColor: colors.destructive, backgroundColor: colors.card }]}
      >
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          {error instanceof Error && error.message
            ? error.message
            : tr("Не удалось загрузить данные", "Деректерді жүктеу мүмкін болмады")}
        </Text>
        <Button variant="outline" size="sm" onPress={retry}>
          {tr("Повторить", "Қайталау")}
        </Button>
      </View>
    )
  }
  if (loading) {
    return (
      <View style={styles.skeletons} accessibilityLabel={tr("Загрузка", "Жүктелуде")}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={76} radius={12} />
        ))}
      </View>
    )
  }
  return null
}

const styles = StyleSheet.create({
  error: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 12, alignItems: "flex-start" },
  errorText: { fontSize: 14, lineHeight: 20, fontFamily: fonts.sans },
  skeletons: { gap: 10 },
})
