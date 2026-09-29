import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import useSWR from "swr"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LoadState } from "@/components/ui/load-state"
import { useAuth } from "@/lib/api/auth-context"
import { api } from "@/lib/api/client"
import { useTr } from "@/lib/i18n/use-tr"
import { personName, profileHref, type Person } from "@/lib/social/types"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"
import { errorMessage } from "./shared"

export function FollowButton({ person, refresh }: { person: Person; refresh: () => void | Promise<unknown> }) {
  const [busy, setBusy] = useState(false)
  const tr = useTr()
  const { user } = useAuth()
  if (person.id === user?.id) return null
  const following = !!person.followers?.length
  return (
    <Button
      size="sm"
      variant={following ? "outline" : "primary"}
      disabled={busy}
      onPress={async () => {
        setBusy(true)
        try {
          await api(`/social/people/${person.id}/follow`, { method: following ? "DELETE" : "PUT" })
          await refresh()
        } catch (e) {
          Alert.alert(tr("Ошибка", "Қате"), errorMessage(e))
        } finally {
          setBusy(false)
        }
      }}
    >
      {following ? tr("Вы подписаны", "Жазылғансыз") : tr("Подписаться", "Жазылу")}
    </Button>
  )
}

/** Search field (when browsing everyone) and a list of people; also followers/following of a user. */
export function PeopleList({ userId, relation }: { userId?: string; relation?: "followers" | "following" }) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setQ(search), 300)
    return () => clearTimeout(timer)
  }, [search])
  const { data, error, isLoading, mutate } = useSWR<Person[]>(
    `/social/people?q=${encodeURIComponent(q)}${userId ? `&userId=${userId}&relation=${relation}` : ""}`,
  )

  return (
    <Card padded={false}>
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={tr("Поиск по имени", "Аты бойынша іздеу")}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={tr("Поиск людей", "Адамдарды іздеу")}
          maxLength={100}
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.input, { color: colors.foreground }]}
        />
      </View>
      <View style={styles.pad}>
        <LoadState loading={isLoading} error={error} retry={() => void mutate()} />
      </View>
      {data?.map((p) => (
        <View key={p.id} style={[styles.row, { borderTopColor: colors.border }]}>
          <Pressable accessibilityRole="link" onPress={() => router.push(profileHref(p.id))} style={styles.who}>
            <Avatar person={p} />
            <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
              {personName(p)}
            </Text>
          </Pressable>
          <FollowButton person={p} refresh={() => mutate()} />
        </View>
      ))}
      {!isLoading && !error && !data?.length ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>{tr("Пока никого не нашли", "Әзірге ешкім табылмады")}</Text>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.sans, paddingVertical: 8 },
  pad: { paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  who: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  name: { flexShrink: 1, fontSize: 14, fontFamily: fonts.sansSemi },
  empty: { textAlign: "center", padding: 32, fontSize: 14 },
})
