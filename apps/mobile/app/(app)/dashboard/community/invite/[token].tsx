import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { Alert, StyleSheet, Text, View } from "react-native"
import useSWR from "swr"
import { CommunityGate } from "@/components/community/CommunityGate"
import { errorMessage } from "@/components/community/shared"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LoadState } from "@/components/ui/load-state"
import { Screen } from "@/components/ui/screen"
import { api } from "@/lib/api/client"
import { useTr } from "@/lib/i18n/use-tr"
import type { GroupInvitePreview } from "@/lib/social/types"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const { colors } = useAppTheme()
  const tr = useTr()
  const [busy, setBusy] = useState(false)
  const { data, error, isLoading, mutate } = useSWR<GroupInvitePreview>(`/social/invites/${token}`)

  const join = async () => {
    setBusy(true)
    try {
      const room = await api<{ id: string }>(`/social/invites/${token}/join`, { method: "POST" })
      router.replace(`/dashboard/messages/${room.id}` as never)
    } catch (e) {
      Alert.alert(tr("Ошибка", "Қате"), errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CommunityGate>
      <Screen>
        <LoadState loading={isLoading} error={error} retry={() => void mutate()} />
        {data && !error ? (
          <Card style={styles.card}>
            <View style={[styles.icon, { backgroundColor: `${colors.accent}1A` }]}>
              <MaterialCommunityIcons name="account-group-outline" size={26} color={colors.accent} />
            </View>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{tr("ПРИГЛАШЕНИЕ В ГРУППУ", "ТОПҚА ШАҚЫРУ")}</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
              {data.title}
            </Text>
            {data.description ? <Text style={[styles.text, { color: colors.mutedForeground }]}>{data.description}</Text> : null}
            <Text style={[styles.text, { color: colors.foreground }]}>
              {data._count.members} {tr("участников", "қатысушы")}
            </Text>
            <Button disabled={busy} onPress={() => void join()}>
              {tr("Присоединиться", "Қосылу")}
            </Button>
          </Card>
        ) : null}
      </Screen>
    </CommunityGate>
  )
}

const styles = StyleSheet.create({
  card: { padding: 24, gap: 12, alignItems: "center" },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 11, letterSpacing: 0.8, fontFamily: fonts.sansSemi },
  title: { fontSize: 22, textAlign: "center", fontFamily: fonts.sansSemi },
  text: { fontSize: 14, lineHeight: 21, textAlign: "center" },
})
