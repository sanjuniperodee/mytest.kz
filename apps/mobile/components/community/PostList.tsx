import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native"
import useSWR from "swr"
import useSWRInfinite from "swr/infinite"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LoadState } from "@/components/ui/load-state"
import { SelectSheet } from "@/components/ui/select-sheet"
import { Sheet } from "@/components/ui/sheet"
import { useAuth } from "@/lib/api/auth-context"
import { api } from "@/lib/api/client"
import { useTr } from "@/lib/i18n/use-tr"
import { formatViews, personName, profileHref, type Page, type Post, type Room } from "@/lib/social/types"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"
import { ReportSheet } from "./ReportSheet"
import { confirmAction, errorMessage, setBlocked, useDateLabels } from "./shared"

const SITE = "https://my-test.kz"

export function Composer({
  parentId,
  initialInviteId,
  onDone,
}: {
  parentId?: string
  initialInviteId?: string
  onDone: () => void | Promise<unknown>
}) {
  const { user } = useAuth()
  const { colors } = useAppTheme()
  const tr = useTr()
  const [text, setText] = useState("")
  const [inviteId, setInviteId] = useState(initialInviteId ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const lock = useRef(false)
  const { data: rooms } = useSWR<Room[]>(!parentId ? "/social/rooms" : null)
  const manageable = (rooms ?? []).filter(
    (r) => r.title && !r.archived && r.members.some((m) => m.userId === user?.id && m.role !== "member"),
  )

  const submit = async () => {
    if (!text.trim() || lock.current) return
    lock.current = true
    setError("")
    setBusy(true)
    try {
      await api("/social/posts", {
        method: "POST",
        body: {
          body: text.trim(),
          ...(parentId ? { parentId } : {}),
          ...(inviteId ? { groupInviteId: inviteId } : {}),
        },
      })
      setText("")
      setInviteId("")
      try {
        await onDone()
      } catch {
        // Publishing succeeded; don't suggest sending again.
      }
    } catch (e) {
      setError(errorMessage(e, tr("Не удалось опубликовать", "Жариялау мүмкін болмады")))
    } finally {
      setBusy(false)
      lock.current = false
    }
  }

  return (
    <Card style={styles.composer}>
      <View style={styles.composerRow}>
        {user ? <Avatar person={user} /> : null}
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!busy}
          multiline
          maxLength={2000}
          accessibilityLabel={tr("Текст публикации", "Жарияланым мәтіні")}
          placeholder={
            parentId
              ? tr("Поделись своим ответом…", "Жауабыңмен бөліс…")
              : tr("Что нового? Вопрос, мысль или маленькая победа…", "Не жаңалық? Сұрағыңмен не жетістігіңмен бөліс…")
          }
          placeholderTextColor={colors.mutedForeground}
          style={[styles.composerInput, { color: colors.foreground }]}
        />
      </View>
      {manageable.length > 0 ? (
        <SelectSheet
          label={tr("Пригласить в группу", "Топқа шақыру")}
          value={inviteId}
          options={[
            { value: "", label: tr("Без приглашения", "Шақырусыз") },
            ...manageable.map((r) => ({ value: r.id, label: r.title ?? "" })),
          ]}
          onChange={setInviteId}
        />
      ) : null}
      <View style={styles.composerFoot}>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>
          {text.length ? `${text.length}/2000` : tr("Твоё мнение важно", "Сенің пікірің маңызды")}
        </Text>
        <Button
          size="sm"
          disabled={busy || !text.trim()}
          onPress={() => void submit()}
          icon={(c) => <MaterialCommunityIcons name="send" size={15} color={c} />}
        >
          {busy ? tr("Публикуем…", "Жариялануда…") : parentId ? tr("Ответить", "Жауап беру") : tr("Опубликовать", "Жариялау")}
        </Button>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.small, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}
    </Card>
  )
}

const viewed = new Set<string>()

export function PostCard({
  post,
  refresh,
  nested = false,
}: {
  post: Post
  refresh: () => void | Promise<unknown>
  nested?: boolean
}) {
  const { user } = useAuth()
  const { colors } = useAppTheme()
  const tr = useTr()
  const { shortDate } = useDateLabels()
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [report, setReport] = useState(false)
  const [replying, setReplying] = useState(false)
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [likedOverride, setLikedOverride] = useState<boolean | null>(null)
  const [likesDelta, setLikesDelta] = useState(0)
  const [repostOverride, setRepostOverride] = useState<boolean | null>(null)
  const [repostsDelta, setRepostsDelta] = useState(0)

  const likedServer = post.likes.some((l) => l.userId === user?.id)
  const repostedServer = post.reposts.some((r) => r.userId === user?.id)
  const liked = likedOverride ?? likedServer
  const reposted = repostOverride ?? repostedServer
  const likes = Math.max(0, post._count.likes + likesDelta)
  const reposts = Math.max(0, post._count.reposts + repostsDelta)
  const mine = post.authorId === user?.id

  useEffect(() => {
    if (likedOverride !== null && likedServer === likedOverride) {
      setLikedOverride(null)
      setLikesDelta(0)
    }
  }, [likedServer, likedOverride])
  useEffect(() => {
    if (repostOverride !== null && repostedServer === repostOverride) {
      setRepostOverride(null)
      setRepostsDelta(0)
    }
  }, [repostedServer, repostOverride])
  useEffect(() => {
    if (!post.id || viewed.has(post.id)) return
    viewed.add(post.id)
    api(`/social/posts/${post.id}/view`, { method: "POST" }).catch(() => {})
  }, [post.id])

  const failed = (e: unknown) =>
    Alert.alert(tr("Не удалось сохранить", "Сақтау мүмкін болмады"), errorMessage(e))

  async function toggleLike() {
    if (busy) return
    const next = !liked
    setLikedOverride(next)
    setLikesDelta((d) => d + (next ? 1 : -1))
    try {
      await api(`/social/posts/${post.id}/like`, { method: next ? "PUT" : "DELETE" })
      await refresh()
    } catch (e) {
      setLikedOverride(null)
      setLikesDelta(0)
      failed(e)
    }
  }
  async function toggleRepost() {
    if (busy) return
    const next = !reposted
    setRepostOverride(next)
    setRepostsDelta((d) => d + (next ? 1 : -1))
    try {
      await api(`/social/posts/${post.id}/repost`, { method: next ? "PUT" : "DELETE" })
      await refresh()
    } catch (e) {
      setRepostOverride(null)
      setRepostsDelta(0)
      failed(e)
    }
  }
  async function remove() {
    setMenu(false)
    const ok = await confirmAction({
      title: tr("Удалить публикацию?", "Жарияланымды жою керек пе?"),
      confirm: tr("Удалить", "Жою"),
      cancel: tr("Отмена", "Болдырмау"),
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/social/posts/${post.id}`, { method: "DELETE" })
      await refresh()
    } catch (e) {
      failed(e)
    } finally {
      setBusy(false)
    }
  }
  async function block() {
    setMenu(false)
    const ok = await confirmAction({
      title: tr("Заблокировать пользователя?", "Пайдаланушыны бұғаттау керек пе?"),
      message: tr(
        "Его публикации и личные сообщения будут скрыты.",
        "Оның жазбалары мен жеке хабарламалары жасырылады.",
      ),
      confirm: tr("Заблокировать", "Бұғаттау"),
      cancel: tr("Отмена", "Болдырмау"),
      destructive: true,
    })
    if (!ok) return
    try {
      await setBlocked(post.authorId, true)
    } catch (e) {
      failed(e)
    }
  }

  const open = () => router.push(`/dashboard/community/post/${post.id}` as never)
  const iconColor = colors.mutedForeground

  return (
    <View style={[styles.post, { borderTopColor: colors.border }]}>
      <View style={styles.postRow}>
        <Pressable accessibilityRole="link" accessibilityLabel={personName(post.author)} onPress={() => router.push(profileHref(post.authorId))}>
          <Avatar person={post.author} />
        </Pressable>
        <View style={styles.flex}>
          <View style={styles.meta}>
            <Text
              numberOfLines={1}
              onPress={() => router.push(profileHref(post.authorId))}
              style={[styles.author, { color: colors.foreground }]}
            >
              {personName(post.author)}
            </Text>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>{shortDate(post.createdAt)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr("Действия с публикацией", "Жарияланым әрекеттері")}
              hitSlop={8}
              onPress={() => setMenu(true)}
              style={styles.more}
            >
              <MaterialCommunityIcons name="dots-horizontal" size={20} color={iconColor} />
            </Pressable>
          </View>
          {post.parentId ? (
            <Text
              onPress={() => router.push(`/dashboard/community/post/${post.parentId}` as never)}
              style={[styles.small, { color: colors.mutedForeground }]}
            >
              {tr("В ответ на публикацию ↗", "Жарияланымға жауап ↗")}
            </Text>
          ) : null}
          <Text style={[styles.body, { color: colors.foreground }]}>{post.body}</Text>

          {post.groupInvite && post.groupInviteToken ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/dashboard/community/invite/${post.groupInviteToken}` as never)}
              style={[styles.invite, { borderColor: `${colors.accent}33`, backgroundColor: `${colors.accent}14` }]}
            >
              <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Приглашение в группу", "Топқа шақыру")}</Text>
              <Text style={[styles.author, { color: colors.foreground }]}>{post.groupInvite.title}</Text>
              <Text style={[styles.link, { color: colors.foreground }]}>
                {post.groupInvite.archived ? tr("Группа закрыта", "Топ жабылған") : tr("Посмотреть и присоединиться →", "Көру және қосылу →")}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <Action
              label={tr("Нравится", "Ұнайды")}
              icon={liked ? "heart" : "heart-outline"}
              color={liked ? "#F43F5E" : iconColor}
              count={likes}
              selected={liked}
              onPress={() => void toggleLike()}
            />
            <Action
              label={nested ? tr("Ответить", "Жауап беру") : tr("Комментарии", "Пікірлер")}
              icon="comment-outline"
              color={iconColor}
              count={post._count.replies}
              onPress={nested ? () => setReplying((v) => !v) : open}
            />
            <Action
              label={tr("Репост", "Репост")}
              icon="repeat"
              color={reposted ? "#059669" : iconColor}
              count={reposts}
              selected={reposted}
              onPress={() => void toggleRepost()}
            />
            <View accessibilityLabel={tr("Просмотры", "Қаралымдар")} style={styles.action}>
              <MaterialCommunityIcons name="eye-outline" size={18} color={iconColor} />
              <Text style={[styles.small, { color: iconColor }]}>{formatViews(post.views)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr("Поделиться ссылкой", "Сілтемемен бөлісу")}
              hitSlop={8}
              onPress={() => void Share.share({ message: `${SITE}/dashboard/community/post/${post.id}` })}
              style={styles.action}
            >
              <MaterialCommunityIcons name="share-variant-outline" size={18} color={iconColor} />
            </Pressable>
          </View>

          {nested && replying ? (
            <View style={styles.nestedBlock}>
              <Composer
                parentId={post.id}
                onDone={async () => {
                  setReplying(false)
                  await refresh()
                }}
              />
            </View>
          ) : null}
          {nested && post._count.replies > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setRepliesOpen((v) => !v)} style={styles.toggle}>
              <Text style={[styles.link, { color: colors.mutedForeground }]}>
                {repliesOpen
                  ? tr("Скрыть ответы", "Жауаптарды жасыру")
                  : tr(`Посмотреть все ответы (${post._count.replies})`, `Барлық жауапты көру (${post._count.replies})`)}
              </Text>
            </Pressable>
          ) : null}
          {nested && repliesOpen ? (
            <View style={[styles.replies, { borderLeftColor: colors.border }]}>
              <PostList parentId={post.id} nested toolbar={false} />
            </View>
          ) : null}
        </View>
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={tr("Публикация", "Жарияланым")}>
        <View style={styles.menu}>
          {mine || user?.isAdmin ? (
            <MenuRow icon="trash-can-outline" label={tr("Удалить", "Жою")} destructive onPress={() => void remove()} />
          ) : (
            <>
              <MenuRow
                icon="flag-outline"
                label={tr("Пожаловаться", "Шағымдану")}
                onPress={() => {
                  setMenu(false)
                  setReport(true)
                }}
              />
              <MenuRow icon="account-cancel-outline" label={tr("Заблокировать автора", "Авторды бұғаттау")} destructive onPress={() => void block()} />
            </>
          )}
        </View>
      </Sheet>
      <ReportSheet visible={report} onClose={() => setReport(false)} path={`/social/posts/${post.id}/report`} />
    </View>
  )
}

function MenuRow({ icon, label, onPress, destructive }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; destructive?: boolean }) {
  const { colors } = useAppTheme()
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.menuRow, { borderBottomColor: colors.border }]}>
      <MaterialCommunityIcons name={icon} size={20} color={destructive ? colors.destructive : colors.foreground} />
      <Text style={[styles.menuText, { color: destructive ? colors.destructive : colors.foreground }]}>{label}</Text>
    </Pressable>
  )
}

function Action({ label, icon, color, count, selected, onPress }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; count: number; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      hitSlop={6}
      onPress={onPress}
      style={styles.action}
    >
      <MaterialCommunityIcons name={icon} size={19} color={color} />
      <Text style={[styles.small, { color }]}>{count}</Text>
    </Pressable>
  )
}

export function PostList({
  query = "",
  composer = false,
  parentId,
  onChange,
  nested = false,
  toolbar = !parentId,
  empty,
  initialInviteId,
}: {
  query?: string
  composer?: boolean
  parentId?: string
  onChange?: () => void | Promise<unknown>
  nested?: boolean
  /** The manual refresh bar belongs to feeds, not to profile tabs or threads. */
  toolbar?: boolean
  empty?: { title: string; text: string }
  initialInviteId?: string
}) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<Page<Post>>(
    (index, previous) =>
      index > 0 && !previous?.nextCursor
        ? null
        : `/social/posts?${query}${parentId ? `${query ? "&" : ""}parentId=${parentId}` : ""}${index ? `&cursor=${previous?.nextCursor}` : ""}`,
    (path: string) => api<Page<Post>>(path),
    { revalidateOnFocus: false, revalidateAll: false, refreshInterval: 0 },
  )
  const posts = [...new Map(data?.flatMap((p) => p.items).map((p) => [p.id, p]) ?? []).values()]
  const following = query.includes("tab=following")

  return (
    <View style={styles.list}>
      {composer ? (
        <Composer
          parentId={parentId}
          initialInviteId={initialInviteId}
          onDone={async () => {
            await mutate()
            await onChange?.()
          }}
        />
      ) : null}
      <Card padded={false} style={nested ? styles.nestedCard : undefined}>
        {toolbar ? (
          <View style={styles.toolbar}>
            <Text style={[styles.small, styles.flex, { color: colors.mutedForeground }]}>
              {tr("Новые публикации — сверху", "Жаңа жазбалар — жоғарыда")}
            </Text>
            <Button variant="ghost" size="sm" disabled={isValidating} onPress={() => void mutate().catch(() => {})}>
              {isValidating ? tr("Обновляем…", "Жаңартылуда…") : tr("Обновить", "Жаңарту")}
            </Button>
          </View>
        ) : null}
        <View style={styles.pad}>
          <LoadState loading={isLoading} error={error} retry={() => void mutate().catch(() => {})} />
        </View>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} refresh={() => mutate()} nested={nested || Boolean(parentId)} />
        ))}
        {!isLoading && !error && !posts.length ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="message-outline" size={32} color={colors.mutedForeground} />
            <Text style={[styles.author, { color: colors.foreground }]}>
              {empty ? empty.title : following ? tr("В подписках пока тихо", "Жазылымдарда әзірге тыныш") : tr("Здесь начинается разговор", "Әңгіме осы жерден басталады")}
            </Text>
            <Text style={[styles.text, { color: colors.mutedForeground }]}>
              {empty
                ? empty.text
                : tr(
                    "Пока публикаций нет. Напиши первым или подпишись на интересных тебе людей.",
                    "Әзірге жарияланым жоқ. Бірінші болып жаз немесе қызықты адамдарға жазыл.",
                  )}
            </Text>
            {!empty && following ? (
              <Button variant="outline" size="sm" onPress={() => router.push("/dashboard/community/people" as never)}>
                {tr("Найти людей", "Адамдарды табу")}
              </Button>
            ) : null}
          </View>
        ) : null}
      </Card>
      {data?.at(-1)?.nextCursor ? (
        <Button variant="outline" disabled={isValidating} onPress={() => void setSize(size + 1).catch(() => {})}>
          {isValidating ? tr("Загрузка…", "Жүктелуде…") : tr("Показать ещё", "Тағы көрсету")}
        </Button>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  list: { gap: 14 },
  pad: { paddingHorizontal: 12 },
  composer: { padding: 14, gap: 12 },
  composerRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  composerInput: { flex: 1, minHeight: 72, fontSize: 15, lineHeight: 22, textAlignVertical: "top", fontFamily: fonts.sans, padding: 0 },
  composerFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  small: { fontSize: 12, lineHeight: 17 },
  text: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14, paddingRight: 6, paddingVertical: 4 },
  post: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14 },
  postRow: { flexDirection: "row", gap: 12 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  author: { fontSize: 14, fontFamily: fonts.sansSemi, flexShrink: 1 },
  more: { marginLeft: "auto", padding: 2 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 4, fontFamily: fonts.sans },
  link: { fontSize: 12, fontFamily: fonts.sansSemi },
  invite: { marginTop: 10, borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 8, marginLeft: -6 },
  action: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 40, paddingHorizontal: 8 },
  nestedBlock: { marginTop: 10 },
  toggle: { minHeight: 36, justifyContent: "center" },
  replies: { borderLeftWidth: 2, paddingLeft: 8, marginTop: 6 },
  nestedCard: { borderRadius: 10 },
  empty: { alignItems: "center", gap: 10, paddingHorizontal: 24, paddingVertical: 40 },
  menu: { paddingTop: 8 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth },
  menuText: { fontSize: 15, fontFamily: fonts.sansSemi },
})
