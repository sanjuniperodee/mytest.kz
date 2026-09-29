import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useRef, useState } from "react"
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LoadState } from "@/components/ui/load-state"
import { Sheet } from "@/components/ui/sheet"
import { useAuth } from "@/lib/api/auth-context"
import { useTr } from "@/lib/i18n/use-tr"
import { personName, profileHref, type Message, type Room } from "@/lib/social/types"
import { useConversation } from "@/lib/social/use-conversation"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAndroidKeyboardHeight } from "@/lib/use-keyboard-height"
import { GroupSettings } from "./Groups"
import { MediaComposer, MessageMedia } from "./Media"
import { ReportSheet } from "./ReportSheet"
import { confirmAction, errorMessage, setBlocked, useDateLabels } from "./shared"

const SAFE_TOP_FALLBACK = "/dashboard/messages"

/** One room: history, sending, attachments and moderation actions. Fills the screen. */
export function Conversation({ id, room, onRead, standalone = false }: { id: string; room?: Room; onRead: () => void; standalone?: boolean }) {
  const { user } = useAuth()
  const { colors } = useAppTheme()
  const tr = useTr()
  const { day, time } = useDateLabels()
  const c = useConversation(id, onRead)
  const insets = useSafeAreaInsets()
  const keyboard = useAndroidKeyboardHeight()
  const listRef = useRef<FlatList<Message>>(null)
  const jumpToLatest = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    c.nearBottom.current = true
    c.setAtBottom(true)
    c.markRead()
  }
  const [settings, setSettings] = useState(false)
  const [actionsFor, setActionsFor] = useState<Message | null>(null)
  const [reporting, setReporting] = useState<Message | null>(null)

  const myMember = room?.members.find((m) => m.userId === user?.id)
  const manager = !!myMember && myMember.role !== "member"
  const restricted = room?.archived || myMember?.muted || (room?.onlyAdminsPost && myMember?.role === "member")
  const other = room?.members.find((m) => m.userId !== user?.id)?.user
  const isGlobal = room?.key === "global"
  const canSend = !!room && !restricted && !c.error
  const sendDisabled = c.sending || c.mediaBusy || (!c.draft.trim() && !c.attachment) || !canSend

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // The list is inverted: offset 0 is the newest message.
    c.nearBottom.current = e.nativeEvent.contentOffset.y < 100
    c.setAtBottom(c.nearBottom.current)
    if (c.nearBottom.current) c.markRead()
  }

  const goBack = () => (router.canGoBack() ? router.back() : router.replace((standalone ? "/dashboard/community" : SAFE_TOP_FALLBACK) as never))

  const removeMessage = async (m: Message) => {
    setActionsFor(null)
    const ok = await confirmAction({
      title: tr("Удалить сообщение?", "Хабарламаны жою керек пе?"),
      confirm: tr("Удалить", "Жою"),
      cancel: tr("Отмена", "Болдырмау"),
      destructive: true,
    })
    if (!ok) return
    try {
      await c.removeMessage(m.id)
    } catch (e) {
      Alert.alert(tr("Ошибка", "Қате"), errorMessage(e))
    }
  }
  const blockAuthor = async (m: Message) => {
    setActionsFor(null)
    const ok = await confirmAction({
      title: tr("Заблокировать пользователя?", "Пайдаланушыны бұғаттау керек пе?"),
      message: tr("Его публикации и личные сообщения будут скрыты.", "Оның жазбалары мен жеке хабарламалары жасырылады."),
      confirm: tr("Заблокировать", "Бұғаттау"),
      cancel: tr("Отмена", "Болдырмау"),
      destructive: true,
    })
    if (!ok) return
    try {
      await setBlocked(m.authorId, true)
      onRead()
      if (room?.kind === "direct") goBack()
    } catch (e) {
      Alert.alert(tr("Ошибка", "Қате"), errorMessage(e))
    }
  }

  const title = isGlobal ? tr("Глобальный чат", "Жаһандық чат") : room?.title || (other ? personName(other) : tr("Переписка", "Хат алмасу"))
  const subtitle =
    room?.kind === "group"
      ? tr("Групповой чат", "Топтық чат")
      : isGlobal
        ? tr("Место встречи сообщества", "Қауымдастықтың кездесу орны")
        : tr("Личная переписка", "Жеке хат алмасу")

  const renderItem = ({ item: m, index }: { item: Message; index: number }) => {
    const mine = m.authorId === user?.id
    const older = c.messages[index + 1]
    // Newest-first list: a day label is drawn above the oldest message of each day.
    const showDay = !older || day(older.createdAt) !== day(m.createdAt)
    const fg = mine ? colors.background : colors.foreground
    return (
      <View>
        {showDay ? <Text style={[styles.day, { color: colors.mutedForeground }]}>{day(m.createdAt)}</Text> : null}
        <View style={[styles.line, mine && styles.lineMine]}>
          {!mine ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`${tr("Профиль", "Профиль")}: ${personName(m.author)}`} onPress={() => router.push(profileHref(m.authorId))}>
              <Avatar person={m.author} size={30} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityHint={tr("Удерживайте для действий", "Әрекеттер үшін басып тұрыңыз")}
            onLongPress={() => setActionsFor(m)}
            delayLongPress={300}
            style={[
              styles.bubble,
              mine
                ? { backgroundColor: colors.foreground, borderBottomRightRadius: 4 }
                : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 4 },
            ]}
          >
            {!mine ? (
              <Text onPress={() => router.push(profileHref(m.authorId))} style={[styles.author, { color: colors.accent }]}>
                {personName(m.author)}
              </Text>
            ) : null}
            {m.body ? <Text style={[styles.body, { color: fg }]}>{m.body}</Text> : null}
            {m.attachment ? <MessageMedia file={m.attachment} onDark={mine} /> : null}
            <Text style={[styles.time, { color: fg }]}>{time(m.createdAt)}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      // On Android the keyboard height is applied as plain padding (see useAndroidKeyboardHeight).
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.flex, { backgroundColor: colors.background, paddingBottom: Platform.OS === "android" ? keyboard : 0 }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Назад", "Артқа")} onPress={goBack} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        {room?.kind === "group" || isGlobal ? (
          <View style={[styles.roomIcon, { backgroundColor: `${colors.accent}1A` }]}>
            <MaterialCommunityIcons name={isGlobal ? "earth" : "account-group-outline"} size={20} color={colors.accent} />
          </View>
        ) : other ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(profileHref(other.id))}>
            <Avatar person={other} size={38} />
          </Pressable>
        ) : null}
        <View style={styles.flex}>
          <Text numberOfLines={1} accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {subtitle}
          </Text>
        </View>
        {room?.kind === "group" ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tr("Управление группой", "Топты басқару")} onPress={() => setSettings(true)} style={styles.back}>
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.flex, { backgroundColor: colors.secondary }]}>
        <FlatList
          ref={listRef}
          inverted
          data={c.messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          onScroll={onScroll}
          scrollEventThrottle={64}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listPad}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (c.data?.at(-1)?.nextCursor && !c.isValidating) void c.setSize(c.size + 1).catch(() => {})
          }}
          ListHeaderComponent={<LoadState loading={false} error={c.error} retry={() => void c.mutate().catch(() => {})} />}
          ListFooterComponent={
            c.isLoading ? (
              <LoadState loading retry={() => {}} />
            ) : c.data?.at(-1)?.nextCursor ? (
              <Text style={[styles.older, { color: colors.mutedForeground }]}>{tr("Загружаем ранние сообщения…", "Алдыңғы хабарламалар жүктелуде…")}</Text>
            ) : null
          }
          ListEmptyComponent={
            !c.isLoading && !c.error ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="message-outline" size={36} color={colors.mutedForeground} />
                <Text style={[styles.title, { color: colors.foreground }]}>{tr("Начни с приветствия", "Сәлемдесуден баста")}</Text>
                <Text style={[styles.subtitle, styles.center, { color: colors.mutedForeground }]}>
                  {tr("Хороший разговор может стать началом большой дружбы.", "Жақсы әңгіме үлкен достықтың бастауы болуы мүмкін.")}
                </Text>
              </View>
            ) : null
          }
        />
        {!c.atBottom ? (
          <View style={styles.jump} pointerEvents="box-none">
            <Button variant="outline" size="sm" onPress={jumpToLatest} icon={(col) => <MaterialCommunityIcons name="arrow-down" size={16} color={col} />}>
              {tr("К новым", "Жаңаларға")}
            </Button>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.footer,
          { borderTopColor: colors.border, backgroundColor: colors.background },
          // Above the gesture bar; the keyboard already covers it while typing.
          { paddingBottom: keyboard > 0 ? 8 : Math.max(8, insets.bottom) },
        ]}
      >
        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          {tr("Модераторы платформы могут просматривать сообщения и вложения.", "Платформа модераторлары хабарламалар мен тіркемелерді көре алады.")}
        </Text>
        {restricted ? (
          <Text accessibilityRole="alert" style={styles.restricted}>
            {tr("Отправка сообщений ограничена администратором.", "Хабарлама жіберуді әкімші шектеген.")}
          </Text>
        ) : null}
        {c.sendError ? (
          <Text accessibilityRole="alert" style={[styles.note, { color: colors.destructive }]}>
            {c.sendError}
          </Text>
        ) : null}
        <MediaComposer roomId={id} attachment={c.attachment} onChange={c.setAttachment} onBusy={c.setMediaBusy} disabled={c.sending || !canSend} />
        <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
          <TextInput
            value={c.draft}
            onChangeText={c.setDraft}
            editable={!c.sending && canSend}
            multiline
            maxLength={2000}
            accessibilityLabel={tr("Сообщение", "Хабарлама")}
            placeholder={tr("Напиши сообщение…", "Хабарлама жаз…")}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr("Отправить", "Жіберу")}
            accessibilityState={{ disabled: sendDisabled }}
            disabled={sendDisabled}
            onPress={() => void c.send().then(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }))}
            style={[styles.send, { backgroundColor: colors.foreground, opacity: sendDisabled ? 0.4 : 1 }]}
          >
            <MaterialCommunityIcons name="send" size={18} color={colors.background} />
          </Pressable>
        </View>
      </View>

      {room?.kind === "group" ? <GroupSettings id={id} visible={settings} onClose={() => setSettings(false)} onChange={onRead} /> : null}

      <Sheet visible={!!actionsFor} onClose={() => setActionsFor(null)} title={tr("Сообщение", "Хабарлама")}>
        {actionsFor ? (
          <View style={styles.menu}>
            {actionsFor.authorId === user?.id || manager ? (
              <MenuRow icon="trash-can-outline" label={tr("Удалить", "Жою")} destructive onPress={() => void removeMessage(actionsFor)} />
            ) : null}
            {actionsFor.authorId !== user?.id ? (
              <>
                <MenuRow
                  icon="flag-outline"
                  label={tr("Пожаловаться", "Шағымдану")}
                  onPress={() => {
                    setReporting(actionsFor)
                    setActionsFor(null)
                  }}
                />
                <MenuRow icon="account-cancel-outline" label={tr("Заблокировать автора", "Авторды бұғаттау")} destructive onPress={() => void blockAuthor(actionsFor)} />
              </>
            ) : null}
          </View>
        ) : null}
      </Sheet>
      <ReportSheet visible={!!reporting} onClose={() => setReporting(null)} path={reporting ? `/social/rooms/${id}/messages/${reporting.id}/report` : ""} />
    </KeyboardAvoidingView>
  )
}

function MenuRow({ icon, label, onPress, destructive }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; destructive?: boolean }) {
  const { colors } = useAppTheme()
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.menuRow, { borderBottomColor: colors.border }]}>
      <MaterialCommunityIcons name={icon} size={20} color={destructive ? colors.destructive : colors.foreground} />
      <Text style={[styles.title, { color: destructive ? colors.destructive : colors.foreground }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  roomIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: fonts.sansSemi },
  subtitle: { fontSize: 12 },
  center: { textAlign: "center" },
  listPad: { padding: 12, gap: 8, flexGrow: 1 },
  day: { textAlign: "center", fontSize: 12, marginVertical: 12 },
  line: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingRight: 36 },
  lineMine: { justifyContent: "flex-end", paddingRight: 0, paddingLeft: 36 },
  bubble: { flexShrink: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  author: { fontSize: 12, fontFamily: fonts.sansSemi },
  body: { fontSize: 15, lineHeight: 21, fontFamily: fonts.sans },
  time: { fontSize: 10, opacity: 0.6, textAlign: "right" },
  older: { textAlign: "center", fontSize: 12, padding: 12 },
  empty: { alignItems: "center", gap: 8, padding: 32, transform: [{ scaleY: -1 }] },
  jump: { position: "absolute", bottom: 12, left: 0, right: 0, alignItems: "center" },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8 },
  note: { fontSize: 10, lineHeight: 14, marginBottom: 4 },
  restricted: { fontSize: 12, fontFamily: fonts.sansSemi, color: "#D97706", marginBottom: 4 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 6 },
  input: { flex: 1, minHeight: 38, maxHeight: 120, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 9, fontSize: 15, fontFamily: fonts.sans },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  menu: { paddingTop: 8 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth },
})
