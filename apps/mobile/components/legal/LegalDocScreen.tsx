import { Linking, ScrollView, StyleSheet, Text, View } from "react-native"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

type Props = {
  title: string
  /** Markdown-lite: `## headings`, paragraphs, **bold** and [links](https://…). */
  content: string
}

/** Splits a paragraph into plain, bold and link runs. */
function inline(text: string): { text: string; bold?: boolean; href?: string }[] {
  const out: { text: string; bold?: boolean; href?: string }[] = []
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index! > last) out.push({ text: text.slice(last, match.index) })
    if (match[1] !== undefined) out.push({ text: match[1], bold: true })
    else out.push({ text: match[2], href: match[3] })
    last = match.index! + match[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

export function LegalDocScreen({ title, content }: Props) {
  const { colors } = useAppTheme()
  const blocks = content.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.pad}>
      <Text accessibilityRole="header" style={[styles.h1, { color: colors.foreground }]}>
        {title}
      </Text>
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <Text key={i} accessibilityRole="header" style={[styles.h2, { color: colors.foreground }]}>
              {block.replace(/^##\s+/, "")}
            </Text>
          )
        }
        return (
          <View key={i} style={styles.block}>
            {block.split("\n").map((line, j) => (
              <Text key={j} style={[styles.p, { color: colors.mutedForeground }]}>
                {inline(line).map((run, k) => (
                  <Text
                    key={k}
                    onPress={run.href ? () => void Linking.openURL(run.href!) : undefined}
                    style={[
                      run.bold && { fontFamily: fonts.sansSemi, color: colors.foreground },
                      run.href && { color: colors.accent, textDecorationLine: "underline" },
                    ]}
                  >
                    {run.text}
                  </Text>
                ))}
              </Text>
            ))}
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 48 },
  h1: { fontSize: 24, fontFamily: fonts.sansSemi, letterSpacing: -0.3, marginBottom: 16 },
  h2: { fontSize: 17, fontFamily: fonts.sansSemi, marginTop: 8, marginBottom: 8 },
  block: { marginBottom: 14 },
  p: { fontSize: 15, lineHeight: 22 },
})
