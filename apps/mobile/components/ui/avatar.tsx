import { Image, StyleSheet, Text, View } from "react-native"
import { resolveMediaUrl } from "@/lib/api/client"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

export type AvatarPerson = {
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
}

export function personName(p: AvatarPerson): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "mytest user"
}

export function Avatar({ person, size = 40 }: { person: AvatarPerson; size?: number }) {
  const { colors } = useAppTheme()
  const uri = resolveMediaUrl(person.avatarUrl ?? null)
  const box = { width: size, height: size, borderRadius: size / 2 }
  return (
    <View
      accessible={false}
      style={[styles.box, box, { backgroundColor: colors.secondary, borderColor: colors.border }]}
    >
      {uri ? (
        <Image source={{ uri }} style={box} />
      ) : (
        <Text style={[styles.initials, { color: colors.foreground, fontSize: Math.max(10, size * 0.34) }]}>
          {personName(person).slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: { fontFamily: fonts.sansSemi },
})
