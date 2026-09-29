import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import useSWR, { useSWRConfig } from "swr"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LoadState } from "@/components/ui/load-state"
import { PageHeader } from "@/components/ui/page-header"
import { Screen } from "@/components/ui/screen"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { useAuth } from "@/lib/api/auth-context"
import { useTr } from "@/lib/i18n/use-tr"
import { personName, type Room } from "@/lib/social/types"
import { UNREAD_KEY } from "@/lib/social/use-unread"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"
import { CreateGroup } from "./Groups"
import { useDateLabels } from "./shared"

type Filter = "all" | "unread" | "group"

/** Conversation list: direct chats and study groups. */
export function Inbox() {
  const { user } = useAuth()
  const { colors } = useAppTheme()
  const tr = useTr()
  const { shortDate } = useDateLabels()
  const { mutate: mutateGlobal } = useSWRConfig()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [creating, setCreating] = useState(false)
  const { data, error, isLoading, mutate } = useSWR<Room[]>("/social/rooms", { refreshInterval: 10000 })

  const rooms = (data ?? []).filter((r) => r.kind !== "global")
  const unread = rooms.reduce((sum, r) => sum + r.unread, 0)
  // Keep the navigation badge in step with what this inbox shows.
  useEffect(() => {
    if (data) void mutateGlobal(UNREAD_KEY, { count: unread }, { revalidate: false })
  }, [data, unread, mutateGlobal])

  const title = (r: Room) => r.title || personName(r.members.find((m) => m.userId !== user?.id)?.user ?? { firstName: null, lastName: null })
  const visible = rooms.filter(
    (r) => (filter === "all" || (filter === "unread" ? r.unread > 0 : r.kind === filter)) && title(r).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )
  const preview = (r: Room) => {
    const m = r.messages[0]
    if (!m) return tr("Пока нет сообщений", "Әзірге хабарлама жоқ")
    if (m.body) return m.body
    const mime = m.attachment?.mime || ""
    return mime.startsWith("audio/") ? tr("Голосовое сообщение", "Дауыстық хабарлама") : mime.startsWith("image/") ? tr("Фото", "Фото") : mime.startsWith("video/") ? tr("Видео", "Бейне") : tr("Вложение", "Тіркеме")
  }

  return (
    <Screen onRefresh={() => void mutate()} refreshing={false}>
      <PageHeader
        title={tr("Сообщения", "Хабарламалар")}
        description={
          unread
            ? tr(`Непрочитанных: ${unread}`, `Оқылмаған: ${unread}`)
            : tr("Личные разговоры и учебные группы", "Жеке әңгімелер мен оқу топтары")
        }
        actions={
          <>
            <Button variant="outline" size="sm" onPress={() => setCreating(true)} icon={(c) => <MaterialCommunityIcons name="account-multiple-plus-outline" size={16} color={c} />}>
              {tr("Создать группу", "Топ құру")}
            </Button>
            <Button variant="outline" size="sm" onPress={() => router.push("/dashboard/community/people" as never)} icon={(c) => <MaterialCommunityIcons name="plus" size={16} color={c} />}>
              {tr("Новый чат", "Жаңа чат")}
            </Button>
          </>
        }
      />
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={tr("Имя или название группы", "Аты немесе топ атауы")}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={tr("Поиск чатов", "Чаттарды іздеу")}
          style={[styles.input, { color: colors.foreground }]}
        />
      </View>
      <SegmentedTabs
        value={filter}
        onChange={setFilter}
        items={[
          { value: "all", label: tr("Все", "Барлығы") },
          { value: "unread", label: tr("Непрочитанные", "Оқылмаған") },
          { value: "group", label: tr("Группы", "Топтар") },
        ]}
      />
      <Card padded={false}>
        <View style={styles.pad}>
          <LoadState loading={isLoading} error={error} retry={() => void mutate().catch(() => {})} />
        </View>
        {visible.map((r) => {
          const other = r.members.find((m) => m.userId !== user?.id)?.user
          const last = r.messages[0]
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => router.push(`/dashboard/messages/${r.id}` as never)}
              style={[styles.room, { borderTopColor: colors.border }]}
            >
              {r.kind === "group" ? (
                <View style={[styles.groupIcon, { backgroundColor: colors.secondary }]}>
                  <MaterialCommunityIcons name="account-group-outline" size={22} color={colors.foreground} />
                </View>
              ) : other ? (
                <Avatar person={other} />
              ) : null}
              <View style={styles.flex}>
                <View style={styles.between}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
                    {title(r)}
                  </Text>
                  {last ? <Text style={[styles.small, { color: colors.mutedForeground }]}>{shortDate(last.createdAt)}</Text> : null}
                </View>
                <Text numberOfLines={1} style={[styles.small, { color: colors.mutedForeground }]}>
                  {last?.authorId === user?.id ? `${tr("Вы", "Сіз")}: ` : ""}
                  {preview(r)}
                </Text>
                {r.archived ? <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Группа закрыта", "Топ жабық")}</Text> : null}
              </View>
              {r.unread > 0 ? (
                <View accessibilityLabel={tr("Непрочитанные", "Оқылмаған")} style={[styles.badge, { backgroundColor: colors.foreground }]}>
                  <Text style={[styles.badgeText, { color: colors.background }]}>{r.unread > 99 ? "99+" : r.unread}</Text>
                </View>
              ) : null}
            </Pressable>
          )
        })}
        {!isLoading && !error && visible.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="message-outline" size={30} color={colors.mutedForeground} />
            <Text style={[styles.name, { color: colors.foreground }]}>
              {search.trim() ? tr("Чаты не найдены", "Чаттар табылмады") : filter === "unread" ? tr("Всё прочитано", "Бәрі оқылды") : tr("Начните разговор", "Әңгіме бастаңыз")}
            </Text>
            <Text style={[styles.small, styles.center, { color: colors.mutedForeground }]}>
              {search.trim()
                ? tr("Проверьте имя или очистите поиск.", "Атын тексеріңіз немесе іздеуді тазалаңыз.")
                : tr("Найдите человека в сообществе или создайте учебную группу.", "Қауымдастықтан адам табыңыз немесе оқу тобын құрыңыз.")}
            </Text>
            {search || filter !== "all" ? (
              <Button variant="outline" size="sm" onPress={() => { setSearch(""); setFilter("all") }}>
                {tr("Сбросить фильтры", "Сүзгілерді тазалау")}
              </Button>
            ) : null}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/dashboard/global-chat" as never)}
          style={[styles.room, { borderTopColor: colors.border }]}
        >
          <View style={[styles.groupIcon, { backgroundColor: `${colors.accent}1A` }]}>
            <MaterialCommunityIcons name="earth" size={22} color={colors.accent} />
          </View>
          <Text style={[styles.name, styles.flex, { color: colors.foreground }]}>{tr("Глобальный чат", "Жаһандық чат")}</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground} />
        </Pressable>
      </Card>
      <CreateGroup visible={creating} onClose={() => setCreating(false)} onCreated={() => void mutate()} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.sans, paddingVertical: 8 },
  room: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 68, borderTopWidth: StyleSheet.hairlineWidth },
  groupIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontSize: 14, fontFamily: fonts.sansSemi, flexShrink: 1 },
  small: { fontSize: 12, lineHeight: 17 },
  center: { textAlign: "center" },
  badge: { minWidth: 22, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 11, alignItems: "center" },
  badgeText: { fontSize: 11, fontFamily: fonts.sansBold },
  empty: { alignItems: "center", gap: 10, padding: 28 },
})
