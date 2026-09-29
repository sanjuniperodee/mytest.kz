import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import useSWR from "swr"
import { CommunityGate } from "@/components/community/CommunityGate"
import { PostCard, PostList } from "@/components/community/PostList"
import { Card } from "@/components/ui/card"
import { LoadState } from "@/components/ui/load-state"
import { PageHeader } from "@/components/ui/page-header"
import { Screen } from "@/components/ui/screen"
import { useTr } from "@/lib/i18n/use-tr"
import type { Post } from "@/lib/social/types"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { colors } = useAppTheme()
  const tr = useTr()
  const { data, error, isLoading, mutate } = useSWR<Post>(`/social/posts/${id}`, { refreshInterval: 4000 })

  return (
    <CommunityGate>
      <Screen>
        <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.replace("/dashboard/community" as never))} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={18} color={colors.mutedForeground} />
          <Text style={[styles.backText, { color: colors.mutedForeground }]}>{tr("К ленте", "Лентаға оралу")}</Text>
        </Pressable>
        <PageHeader title={tr("Обсуждение", "Талқылау")} />
        <LoadState loading={isLoading} error={error} retry={() => void mutate()} />
        {data && !error ? (
          <>
            <Card padded={false}>
              <PostCard post={data} refresh={() => mutate()} />
            </Card>
            <View style={styles.replies}>
              <Text style={[styles.h, { color: colors.foreground }]}>{tr("Ответы", "Жауаптар")}</Text>
              <PostList
                key={id}
                parentId={id}
                composer
                onChange={() => mutate()}
                empty={{
                  title: tr("Ответов пока нет", "Әзірге жауап жоқ"),
                  text: tr("Помогите автору — ответьте первым.", "Авторға көмектесіңіз — бірінші болып жауап беріңіз."),
                }}
              />
            </View>
          </>
        ) : null}
      </Screen>
    </CommunityGate>
  )
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, alignSelf: "flex-start" },
  backText: { fontSize: 14, fontFamily: fonts.sans },
  replies: { gap: 10 },
  h: { fontSize: 14, fontFamily: fonts.sansSemi },
})
