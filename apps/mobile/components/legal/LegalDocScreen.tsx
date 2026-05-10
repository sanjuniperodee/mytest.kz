import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

type Props = {
  title: string
  /** Плоский текст с абзацами через \\n */
  content: string
}

export function LegalDocScreen({ title, content }: Props) {
  const { colors } = useAppTheme()
  const blocks = content.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.pad}
    >
      <Text style={[styles.h1, { color: colors.foreground }]}>{title}</Text>
      {blocks.map((paragraph, i) => (
        <View key={i} style={styles.block}>
          {paragraph.split("\n").map((line, j) => (
            <Text key={j} style={[styles.p, { color: colors.mutedForeground }]}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 48 },
  h1: {
    fontSize: 24,
    fontFamily: fonts.sansSemi,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  block: { marginBottom: 14 },
  p: { fontSize: 15, lineHeight: 22 },
})
