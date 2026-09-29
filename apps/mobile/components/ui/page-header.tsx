import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

/** Standard screen heading, same structure as the website's PageHeader. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  const { colors } = useAppTheme()
  return (
    <View style={styles.wrap}>
      <View style={styles.copy}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow.toUpperCase()}</Text>
        ) : null}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
          {title}
        </Text>
        {description ? (
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  copy: { gap: 4 },
  eyebrow: { fontSize: 11, letterSpacing: 0.8, fontFamily: fonts.sansSemi },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.5, fontFamily: fonts.sansSemi },
  description: { fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
})
