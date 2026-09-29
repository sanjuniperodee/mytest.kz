import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useState } from "react"
import { Alert, Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import useSWR from "swr"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LoadState } from "@/components/ui/load-state"
import { Sheet } from "@/components/ui/sheet"
import { useAuth } from "@/lib/api/auth-context"
import { api } from "@/lib/api/client"
import { useTr } from "@/lib/i18n/use-tr"
import { personName, type GroupDetail, type GroupMember } from "@/lib/social/types"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"
import { confirmAction, errorMessage } from "./shared"

const SITE = "https://my-test.kz"

export function CreateGroup({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      const room = await api<{ id: string }>("/social/groups", { method: "POST", body: { title: title.trim() } })
      setTitle("")
      onClose()
      onCreated()
      router.push(`/dashboard/messages/${room.id}` as never)
    } catch (e) {
      Alert.alert(tr("Ошибка", "Қате"), errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={tr("Новая группа", "Жаңа топ")}
      description={tr("До 200 участников. Пригласи друзей после создания.", "200 қатысушыға дейін. Құрғаннан кейін достарыңды шақыр.")}
    >
      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{tr("Название", "Атауы")}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
        />
        <Button disabled={busy || !title.trim()} onPress={() => void create()}>
          {tr("Создать", "Құру")}
        </Button>
      </View>
    </Sheet>
  )
}

const ROLE_LABEL = (tr: (ru: string, kk: string) => string, role: string) =>
  role === "owner" ? tr("Владелец", "Иесі") : role === "admin" ? tr("Администратор", "Әкімші") : tr("Участник", "Қатысушы")

export function GroupSettings({ id, visible, onClose, onChange }: { id: string; visible: boolean; onClose: () => void; onChange: () => void }) {
  const { user } = useAuth()
  const { colors } = useAppTheme()
  const tr = useTr()
  const { data, error, isLoading, mutate } = useSWR<GroupDetail>(visible ? `/social/groups/${id}` : null)
  const [busy, setBusy] = useState(false)
  const [memberMenu, setMemberMenu] = useState<GroupMember | null>(null)
  const manager = !!data && data.myRole !== "member"
  const [title, setTitle] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [adminsOnly, setAdminsOnly] = useState<boolean | null>(null)

  const action = async (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => {
    setBusy(true)
    try {
      await api(path, { method, body })
      await mutate()
      onChange()
      return true
    } catch (e) {
      Alert.alert(tr("Ошибка", "Қате"), errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const memberActions = (m: GroupMember): { value: string; label: string; destructive?: boolean }[] => [
    ...(data?.myRole === "owner"
      ? [
          { value: m.role === "admin" ? "member" : "admin", label: m.role === "admin" ? tr("Снять администратора", "Әкімшіліктен шығару") : tr("Назначить администратором", "Әкімші тағайындау") },
          { value: "transfer", label: tr("Передать владение", "Иелікті беру"), destructive: true },
        ]
      : []),
    { value: m.muted ? "unmute" : "mute", label: m.muted ? tr("Разрешить писать", "Жазуға рұқсат беру") : tr("Запретить писать", "Жазуға тыйым салу") },
    { value: m.banned ? "unban" : "ban", label: m.banned ? tr("Разблокировать", "Бұғаттан шығару") : tr("Заблокировать", "Бұғаттау"), destructive: !m.banned },
    { value: "remove", label: tr("Исключить", "Шығару"), destructive: true },
  ]

  const inviteUrl = data?.inviteToken ? `${SITE}/dashboard/community/invite/${data.inviteToken}` : null

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        title={tr("Участники и настройки", "Қатысушылар мен баптаулар")}
        description={tr("Управляй группой, приглашениями и доступом.", "Топты, шақыруларды және қолжетімділікті басқар.")}
      >
        <LoadState loading={isLoading} error={error} retry={() => void mutate()} />
        {data ? (
          <View style={styles.form}>
            {manager && !data.archived ? (
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>{tr("Название", "Атауы")}</Text>
                <TextInput
                  value={title ?? data.title ?? ""}
                  onChangeText={setTitle}
                  maxLength={100}
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                />
                <Text style={[styles.label, { color: colors.mutedForeground }]}>{tr("Описание", "Сипаттамасы")}</Text>
                <TextInput
                  value={description ?? data.description}
                  onChangeText={setDescription}
                  maxLength={500}
                  multiline
                  style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                />
                <View style={styles.switchRow}>
                  <Text style={[styles.text, { color: colors.foreground }]}>{tr("Писать могут только администраторы", "Тек әкімшілер жаза алады")}</Text>
                  <Switch value={adminsOnly ?? data.onlyAdminsPost} onValueChange={setAdminsOnly} />
                </View>
                <Button
                  size="sm"
                  disabled={busy || !(title ?? data.title ?? "").trim()}
                  onPress={() =>
                    void action(`/social/groups/${id}`, "PATCH", {
                      title: (title ?? data.title ?? "").trim(),
                      description: description ?? data.description,
                      onlyAdminsPost: adminsOnly ?? data.onlyAdminsPost,
                    })
                  }
                >
                  {tr("Сохранить", "Сақтау")}
                </Button>
              </View>
            ) : (
              <Text style={[styles.text, { color: colors.mutedForeground }]}>{data.description}</Text>
            )}

            {manager && !data.archived ? (
              <View style={[styles.box, { borderColor: colors.border }]}>
                <Text style={[styles.h3, { color: colors.foreground }]}>{tr("Приглашение в группу", "Топқа шақыру")}</Text>
                <View style={styles.row}>
                  {inviteUrl ? (
                    <>
                      <Button variant="outline" size="sm" onPress={() => void Share.share({ message: inviteUrl })} icon={(c) => <MaterialCommunityIcons name="share-variant-outline" size={15} color={c} />}>
                        {tr("Поделиться ссылкой", "Сілтемемен бөлісу")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => {
                          onClose()
                          router.push(`/dashboard/community?invite=${id}` as never)
                        }}
                      >
                        {tr("Пригласить в посте", "Жазбада шақыру")}
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onPress={async () => {
                      const ok = await confirmAction({
                        title: tr("Заменить ссылку?", "Сілтемені ауыстыру керек пе?"),
                        message: tr("Старые приглашения перестанут работать.", "Ескі шақырулар жұмыс істемейді."),
                        confirm: tr("Заменить", "Ауыстыру"),
                        cancel: tr("Отмена", "Болдырмау"),
                      })
                      if (ok) void action(`/social/groups/${id}/invite`, "POST")
                    }}
                    icon={(c) => <MaterialCommunityIcons name="refresh" size={15} color={c} />}
                  >
                    {tr("Новая ссылка", "Жаңа сілтеме")}
                  </Button>
                </View>
              </View>
            ) : null}

            <Text style={[styles.h3, { color: colors.foreground }]}>
              {tr("Участники", "Қатысушылар")} · {data.members.length}
            </Text>
            {data.members.map((m) => {
              const canManage = manager && m.userId !== user?.id && m.role !== "owner" && (data.myRole === "owner" || m.role === "member")
              return (
                <View key={m.userId} style={[styles.member, { borderBottomColor: colors.border }]}>
                  <Avatar person={m.user} />
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={[styles.memberName, { color: colors.foreground }]}>
                      {personName(m.user)}
                    </Text>
                    <Text style={[styles.small, { color: colors.mutedForeground }]}>
                      {ROLE_LABEL(tr, m.role)}
                      {m.muted ? tr(" · без права писать", " · жаза алмайды") : ""}
                      {m.banned ? tr(" · заблокирован", " · бұғатталған") : ""}
                    </Text>
                  </View>
                  {canManage ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${tr("Действия", "Әрекеттер")}: ${personName(m.user)}`} disabled={busy} onPress={() => setMemberMenu(m)} style={styles.dots}>
                      <MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.foreground} />
                    </Pressable>
                  ) : null}
                </View>
              )
            })}

            {data.myRole === "owner" ? (
              <Button
                variant="destructive"
                disabled={busy || data.archived}
                onPress={async () => {
                  const ok = await confirmAction({
                    title: tr("Закрыть группу?", "Топты жабу керек пе?"),
                    message: tr("Отправка и новые приглашения станут недоступны.", "Хабарлама жіберу мен шақыру тоқтатылады."),
                    confirm: tr("Закрыть группу", "Топты жабу"),
                    cancel: tr("Отмена", "Болдырмау"),
                    destructive: true,
                  })
                  if (ok) void action(`/social/groups/${id}`, "DELETE")
                }}
              >
                {tr("Закрыть группу", "Топты жабу")}
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onPress={async () => {
                  if (await action(`/social/groups/${id}/leave`, "POST")) {
                    onClose()
                    router.replace("/dashboard/messages" as never)
                  }
                }}
              >
                {tr("Покинуть группу", "Топтан шығу")}
              </Button>
            )}
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={!!memberMenu} onClose={() => setMemberMenu(null)} title={memberMenu ? personName(memberMenu.user) : ""}>
        {memberMenu
          ? memberActions(memberMenu).map((a) => (
              <Pressable
                key={a.value}
                accessibilityRole="button"
                onPress={async () => {
                  const target = memberMenu
                  setMemberMenu(null)
                  const ok = await confirmAction({
                    title: a.label,
                    message: tr("Применить действие к участнику?", "Қатысушыға әрекетті қолдану керек пе?"),
                    confirm: tr("Применить", "Қолдану"),
                    cancel: tr("Отмена", "Болдырмау"),
                    destructive: a.destructive,
                  })
                  if (ok) void action(`/social/groups/${id}/members/${target.userId}`, "PATCH", { action: a.value })
                }}
                style={[styles.menuRow, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.memberName, { color: a.destructive ? colors.destructive : colors.foreground }]}>{a.label}</Text>
              </Pressable>
            ))
          : null}
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  form: { gap: 10, paddingTop: 12 },
  section: { gap: 8 },
  label: { fontSize: 13, fontFamily: fonts.sansSemi },
  input: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, fontFamily: fonts.sans },
  multiline: { minHeight: 80, paddingTop: 10, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  text: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  small: { fontSize: 12 },
  h3: { fontSize: 14, fontFamily: fonts.sansSemi },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  member: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  memberName: { fontSize: 14, fontFamily: fonts.sansSemi },
  dots: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  menuRow: { minHeight: 54, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth },
})
