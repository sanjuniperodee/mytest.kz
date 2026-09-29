import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { CommunityGate } from "@/components/community/CommunityGate"
import { PostList } from "@/components/community/PostList"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Screen } from "@/components/ui/screen"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { useTr } from "@/lib/i18n/use-tr"
import { useUnreadMessages } from "@/lib/social/use-unread"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

type Tab = "all" | "following"

export default function CommunityScreen() {
  const { invite } = useLocalSearchParams<{ invite?: string }>()
  const { colors } = useAppTheme()
  const tr = useTr()
  const [tab, setTab] = useState<Tab>("all")
  const unread = useUnreadMessages()

  return (
    <CommunityGate>
      <Screen>
        <PageHeader
          title={tr("Сообщество", "Қауымдастық")}
          description={tr(
            "Задавайте вопросы, делитесь успехами и готовьтесь к ЕНТ вместе.",
            "Сұрақ қойыңыз, жетістіктеріңізбен бөлісіңіз және ҰБТ-ға бірге дайындалыңыз.",
          )}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push("/dashboard/community/people" as never)}
                icon={(c) => <MaterialCommunityIcons name="account-group-outline" size={16} color={c} />}
              >
                {tr("Люди", "Адамдар")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push("/dashboard/messages" as never)}
                icon={(c) => <MaterialCommunityIcons name="message-outline" size={16} color={c} />}
              >
                {tr("Сообщения", "Хабарламалар")}
                {unread > 0 ? (
                  <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.badgeText, { color: colors.accentForeground }]}>{unread > 99 ? "99+" : unread}</Text>
                  </View>
                ) : null}
              </Button>
            </>
          }
        />
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "all", label: tr("Все публикации", "Барлық жазбалар") },
            { value: "following", label: tr("Подписки", "Жазылымдар") },
          ]}
        />
        <PostList key={tab} query={`tab=${tab}`} composer initialInviteId={invite} />
      </Screen>
    </CommunityGate>
  )
}

const styles = StyleSheet.create({
  badge: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, alignItems: "center" },
  badgeText: { fontSize: 11, fontFamily: fonts.sansBold },
})
