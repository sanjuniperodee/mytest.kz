import { Image, StyleSheet, View } from "react-native"
import { resolveMediaUrl } from "@/lib/api/client"

export function QuestionMedia({ src }: { src: string }) {
  const uri = resolveMediaUrl(src)
  if (!uri) return null
  return (
    <View style={styles.wrap}>
      <Image source={{ uri }} style={styles.img} resizeMode="contain" />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  img: {
    width: "100%",
    aspectRatio: 16 / 9,
    maxHeight: 280,
  },
})
