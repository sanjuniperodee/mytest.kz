import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useState } from "react"
import { Alert, Pressable, StyleSheet, Text, View } from "react-native"
import useSWR from "swr"
import { FollowButton, PeopleList } from "@/components/community/People"
import { PostList } from "@/components/community/PostList"
import { confirmAction, errorMessage, setBlocked } from "@/components/community/shared"
import { EditProfileSheet } from "@/components/profile/EditProfileSheet"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LoadState } from "@/components/ui/load-state"
import { Screen } from "@/components/ui/screen"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { Sheet } from "@/components/ui/sheet"
import { useAuth } from "@/lib/api/auth-context"
import { api, ApiError } from "@/lib/api/client"
import { localize } from "@/lib/api/i18n"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { personName, type Profile } from "@/lib/social/types"
import { accentPalette } from "@/lib/theme/accents"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

type Section = "posts" | "replies" | "reposts" | "followers" | "following"

/**
 * The single profile page of the platform: identity, ENT progress and community
 * activity. The owner gets the editor and account tools; everyone else gets
 * follow / message / block.
 */
export function ProfileView({ id }: { id: string }) {
  const { user } = useAuth()
  const tr = useTr()
  const isOwn = id === user?.id
  const { data, error, isLoading, mutate } = useSWR<Profile>(`/social/people/${id}`)
  const [section, setSection] = useState<Section>("posts")

  return (
    <Screen onRefresh={() => void mutate()} refreshing={false}>
      {!isOwn ? (
        <BackLink label={tr("Люди", "Адамдар")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/dashboard/community/people" as never))} />
      ) : null}
      {!data ? <LoadState loading={isLoading} error={error} retry={() => void mutate()} /> : null}
      {data ? (
        <>
          <ProfileHeader profile={data} isOwn={isOwn} section={section} onSection={setSection} refresh={() => mutate()} />
          {data.unavailable ? (
            <Card style={styles.pad}>
              <Text style={styles.muted}>{tr("Взаимодействие с пользователем недоступно", "Пайдаланушымен байланысу мүмкін емес")}</Text>
            </Card>
          ) : (
            <>
              {data.learning ? <LearningCard learning={data.learning} isOwn={isOwn} /> : null}
              <Activity userId={id} name={personName(data)} isOwn={isOwn} section={section} onSection={setSection} />
            </>
          )}
          {isOwn ? <AccountCard /> : null}
        </>
      ) : null}
    </Screen>
  )
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme()
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.back}>
      <MaterialCommunityIcons name="arrow-left" size={18} color={colors.mutedForeground} />
      <Text style={[styles.backText, { color: colors.mutedForeground }]}>{label}</Text>
    </Pressable>
  )
}

function ProfileHeader({
  profile,
  isOwn,
  section,
  onSection,
  refresh,
}: {
  profile: Profile
  isOwn: boolean
  section: Section
  onSection: (s: Section) => void
  refresh: () => Promise<unknown>
}) {
  const { user } = useAuth()
  const { colors, resolved } = useAppTheme()
  const { locale } = useUiLocale()
  const tr = useTr()
  const [editing, setEditing] = useState(false)
  // The owner sees their freshest account data right after editing.
  const person = isOwn && user ? { ...profile, firstName: user.firstName ?? null, lastName: user.lastName ?? null, avatarUrl: user.avatarUrl ?? null } : profile
  const since = new Date(profile.createdAt).toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const paid = Boolean(user?.hasActiveSubscription)
  const contact = user?.phone || (user?.telegramUsername ? `@${user.telegramUsername}` : null)
  const amber = accentPalette(resolved).amber
  const counters: { key: Section; value: number; label: string }[] = [
    { key: "posts", value: profile._count.socialPosts, label: tr("публикаций", "жазба") },
    { key: "followers", value: profile._count.followers, label: tr("подписчиков", "жазылушы") },
    { key: "following", value: profile._count.following, label: tr("подписок", "жазылым") },
  ]

  return (
    <Card style={styles.header}>
      <View style={styles.identity}>
        <Avatar person={person} size={76} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.name, { color: colors.foreground }]}>
            {personName(person)}
          </Text>
          {isOwn ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/dashboard/billing" as never)}
              style={[styles.chip, { backgroundColor: paid ? amber.bg : colors.secondary }]}
            >
              <MaterialCommunityIcons name="crown-outline" size={13} color={paid ? amber.fg : colors.mutedForeground} />
              <Text style={[styles.chipText, { color: paid ? amber.fg : colors.mutedForeground }]}>
                {localize(user?.currentTariff?.name, locale, paid ? "Premium" : tr("Стартовый доступ", "Бастапқы қолжетімділік"))}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr(`На mytest с ${since}`, `mytest-те ${since} бастап`)}</Text>
        </View>
        {isOwn && contact ? (
          <View style={styles.meta}>
            <MaterialCommunityIcons name={user?.phone ? "phone-outline" : "send-outline"} size={14} color={colors.mutedForeground} />
            <Text style={[styles.small, { color: colors.mutedForeground }]}>{contact}</Text>
          </View>
        ) : null}
      </View>
      {!profile.unavailable ? (
        <View style={styles.counters}>
          {counters.map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityState={{ selected: section === c.key }}
              onPress={() => onSection(c.key)}
              style={styles.counter}
            >
              <Text style={[styles.counterValue, { color: colors.foreground, textDecorationLine: section === c.key ? "underline" : "none" }]}>{c.value}</Text>
              <Text style={[styles.small, { color: colors.mutedForeground }]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        {isOwn ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onPress={() => setEditing(true)}
              icon={(c) => <MaterialCommunityIcons name="pencil-outline" size={16} color={c} />}
            >
              {tr("Редактировать профиль", "Профильді өңдеу")}
            </Button>
            <EditProfileSheet visible={editing} onClose={() => setEditing(false)} onSaved={refresh} />
          </>
        ) : (
          <PersonActions profile={profile} refresh={refresh} />
        )}
      </View>
    </Card>
  )
}

function PersonActions({ profile, refresh }: { profile: Profile; refresh: () => Promise<unknown> }) {
  const tr = useTr()
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const { colors } = useAppTheme()

  const message = async () => {
    setBusy(true)
    try {
      const room = await api<{ id: string }>(`/social/rooms/direct/${profile.id}`, { method: "POST" })
      router.push(`/dashboard/messages/${room.id}` as never)
    } catch (e) {
      Alert.alert(tr("Ошибка", "Қате"), errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const toggleBlock = async () => {
    setMenu(false)
    if (
      !profile.blocked &&
      !(await confirmAction({
        title: tr("Заблокировать пользователя?", "Пайдаланушыны бұғаттау керек пе?"),
        message: tr("Его публикации и личные сообщения будут скрыты.", "Оның жазбалары мен жеке хабарламалары жасырылатын болады."),
        confirm: tr("Заблокировать", "Бұғаттау"),
        cancel: tr("Отмена", "Болдырмау"),
        destructive: true,
      }))
    )
      return
    setBusy(true)
    try {
      await setBlocked(profile.id, !profile.blocked)
      await refresh()
    } catch (e) {
      Alert.alert(tr("Ошибка", "Қате"), errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!profile.unavailable ? (
        <>
          <FollowButton person={profile} refresh={refresh} />
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onPress={() => void message()}
            icon={(c) => <MaterialCommunityIcons name="message-outline" size={16} color={c} />}
          >
            {tr("Написать", "Хат жазу")}
          </Button>
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr("Ещё действия", "Басқа әрекеттер")}
        onPress={() => setMenu(true)}
        style={styles.more}
      >
        <MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.foreground} />
      </Pressable>
      <Sheet visible={menu} onClose={() => setMenu(false)} title={personName(profile)}>
        <Pressable accessibilityRole="button" onPress={() => void toggleBlock()} style={styles.menuRow}>
          <MaterialCommunityIcons name="account-cancel-outline" size={20} color={colors.destructive} />
          <Text style={[styles.menuText, { color: colors.destructive }]}>
            {profile.blocked ? tr("Разблокировать", "Бұғаттан шығару") : tr("Заблокировать", "Бұғаттау")}
          </Text>
        </Pressable>
      </Sheet>
    </>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap }) {
  const { colors, resolved } = useAppTheme()
  return (
    <View style={styles.metric}>
      <Text style={[styles.small, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.metricRow}>
        {icon ? <MaterialCommunityIcons name={icon} size={16} color={accentPalette(resolved).amber.fg} /> : null}
        <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  )
}

function LearningCard({ learning, isOwn }: { learning: NonNullable<Profile["learning"]>; isOwn: boolean }) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const best = learning.entBest
  const noAttempts = learning.entAttempts === 0
  return (
    <Card padded={false}>
      <View style={[styles.cardHead, { borderBottomColor: colors.border }]}>
        <View style={styles.meta}>
          <MaterialCommunityIcons name="school-outline" size={17} color={colors.mutedForeground} />
          <Text style={[styles.h2, { color: colors.foreground }]}>{tr("Подготовка к ЕНТ", "ҰБТ-ға дайындық")}</Text>
        </View>
        {isOwn && !noAttempts ? (
          <Pressable accessibilityRole="link" onPress={() => router.push("/dashboard/stats" as never)} style={styles.meta}>
            <Text style={[styles.link, { color: colors.foreground }]}>{tr("Статистика", "Статистика")}</Text>
            <MaterialCommunityIcons name="arrow-right" size={15} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>
      {isOwn && noAttempts ? (
        <View style={styles.pad}>
          <Text style={[styles.text, { color: colors.mutedForeground }]}>
            {tr(
              "Пройдите полный пробный ЕНТ — лучший результат и место в рейтинге появятся в профиле.",
              "Толық ҰБТ сынағын тапсырыңыз — ең жақсы нәтиже мен рейтингтегі орын профильде көрсетіледі.",
            )}
          </Text>
          <Button size="sm" onPress={() => router.push("/dashboard/exams" as never)}>
            {tr("Выбрать пробный", "Сынақты таңдау")}
          </Button>
        </View>
      ) : (
        <>
          <View style={styles.metrics}>
            <Metric label={tr("Лучший результат", "Ең жақсы нәтиже")} value={best ? `${best.rawScore}/${best.maxScore}` : "—"} />
            <Metric label={tr("В рейтинге", "Рейтингте")} value={best ? `#${best.rank}` : "—"} icon={best ? "trophy-outline" : undefined} />
            <Metric label={tr("Пробных ЕНТ", "ҰБТ сынағы")} value={String(learning.entAttempts)} />
          </View>
          {best && best.profileSubjects.length > 0 ? (
            <Text style={[styles.small, styles.footnote, { color: colors.mutedForeground, borderTopColor: colors.border }]}>
              {tr("Профильные предметы", "Бейіндік пәндер")}: <Text style={{ color: colors.foreground, fontFamily: fonts.sansSemi }}>{best.profileSubjects.join(" · ")}</Text>
            </Text>
          ) : null}
          {!best && !isOwn && learning.entAttempts > 0 ? (
            <Text style={[styles.small, styles.footnote, { color: colors.mutedForeground, borderTopColor: colors.border }]}>
              {tr(
                "Результаты показываются в профиле, когда участник входит в топ-100 рейтинга.",
                "Нәтижелер қатысушы рейтингтің үздік 100-іне кірген кезде көрсетіледі.",
              )}
            </Text>
          ) : null}
        </>
      )}
    </Card>
  )
}

function Activity({ userId, name, isOwn, section, onSection }: { userId: string; name: string; isOwn: boolean; section: Section; onSection: (s: Section) => void }) {
  const tr = useTr()
  const { colors } = useAppTheme()
  if (section === "followers" || section === "following") {
    return (
      <View style={styles.gap}>
        <View style={styles.between}>
          <Text style={[styles.h2, { color: colors.foreground }]}>{section === "followers" ? tr("Подписчики", "Жазылушылар") : tr("Подписки", "Жазылымдар")}</Text>
          <Button variant="ghost" size="sm" onPress={() => onSection("posts")}>
            {tr("К публикациям", "Жазбаларға")}
          </Button>
        </View>
        <PeopleList key={section} userId={userId} relation={section} />
      </View>
    )
  }
  return (
    <View style={styles.gap}>
      <SegmentedTabs
        value={section}
        onChange={onSection}
        items={[
          { value: "posts", label: tr("Публикации", "Жазбалар") },
          { value: "replies", label: tr("Ответы", "Жауаптар") },
          { value: "reposts", label: tr("Репосты", "Репосттар") },
        ]}
      />
      <PostList
        key={`${userId}-${section}`}
        query={`authorId=${userId}&tab=${section}`}
        toolbar={false}
        empty={{
          title: tr("Пока пусто", "Әзірге бос"),
          text: isOwn
            ? tr("Поделитесь вопросом или успехом в ленте — публикации появятся здесь.", "Лентада сұрағыңызбен немесе жетістігіңізбен бөлісіңіз — жазбалар осында шығады.")
            : tr(`${name} пока ничего не опубликовал(а) в этом разделе.`, `${name} бұл бөлімде әзірге ештеңе жарияламады.`),
        }}
      />
    </View>
  )
}

/** Legal links and account deletion (required by the stores for apps with accounts). */
function AccountCard() {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { signOut } = useAuth()
  const [deleting, setDeleting] = useState(false)

  const deleteAccount = async () => {
    const ok = await confirmAction({
      title: tr("Удалить аккаунт?", "Аккаунтты жою керек пе?"),
      message: tr(
        "Аккаунт, результаты, публикации и переписки будут удалены без возможности восстановления.",
        "Аккаунт, нәтижелер, жарияланымдар мен хат алмасулар қайтарусыз жойылады.",
      ),
      confirm: tr("Удалить навсегда", "Біржола жою"),
      cancel: tr("Отмена", "Болдырмау"),
      destructive: true,
    })
    if (!ok) return
    setDeleting(true)
    try {
      await api("/users/me", { method: "DELETE" })
      await signOut()
      router.replace("/landing")
    } catch (e) {
      Alert.alert(tr("Ошибка", "Қате"), e instanceof ApiError && e.message ? e.message : tr("Не удалось удалить аккаунт", "Аккаунтты жою мүмкін болмады"))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <View style={styles.gap}>
      <Card style={styles.account}>
        <Text style={[styles.h2, { color: colors.foreground }]}>{tr("Документы и поддержка", "Құжаттар және қолдау")}</Text>
        {(
          [
            ["/legal/privacy", tr("Политика конфиденциальности", "Құпиялылық саясаты")],
            ["/legal/terms", tr("Условия использования", "Пайдалану шарттары")],
            ["/legal/support", tr("Поддержка", "Қолдау")],
          ] as const
        ).map(([href, label]) => (
          <Pressable key={href} accessibilityRole="link" onPress={() => router.push(href as never)} style={styles.docRow}>
            <Text style={[styles.docText, { color: colors.accent }]}>{label}</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </Card>
      <Card style={[styles.account, { borderColor: colors.destructive }]}>
        <Text style={[styles.h2, { color: colors.destructive }]}>{tr("Удалить аккаунт", "Аккаунтты жою")}</Text>
        <Text style={[styles.text, { color: colors.mutedForeground }]}>
          {tr(
            "Аккаунт, результаты, публикации и переписки будут удалены без возможности восстановления.",
            "Аккаунт, нәтижелер, жарияланымдар мен хат алмасулар қайтарусыз жойылады.",
          )}
        </Text>
        <Button variant="outline" disabled={deleting} onPress={() => void deleteAccount()}>
          {deleting ? tr("Удаляем…", "Жойылуда…") : tr("Удалить аккаунт", "Аккаунтты жою")}
        </Button>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 8 },
  gap: { gap: 12 },
  pad: { padding: 16, gap: 12 },
  muted: { fontSize: 14 },
  back: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, alignSelf: "flex-start" },
  backText: { fontSize: 14, fontFamily: fonts.sans },
  header: { padding: 16, gap: 12 },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { fontSize: 24, lineHeight: 30, letterSpacing: -0.4, fontFamily: fonts.sansSemi },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontSize: 12, fontFamily: fonts.sansSemi },
  metaRow: { gap: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  small: { fontSize: 12, lineHeight: 17 },
  counters: { flexDirection: "row", gap: 22 },
  counter: { flexDirection: "row", alignItems: "baseline", gap: 5, minHeight: 32 },
  counterValue: { fontSize: 15, fontFamily: fonts.sansBold },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  more: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 54, marginTop: 8 },
  menuText: { fontSize: 15, fontFamily: fonts.sansSemi },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  h2: { fontSize: 16, fontFamily: fonts.sansSemi },
  link: { fontSize: 13, fontFamily: fonts.sansSemi },
  text: { fontSize: 14, lineHeight: 21 },
  metrics: { flexDirection: "row" },
  metric: { flex: 1, padding: 14, gap: 4 },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metricValue: { fontSize: 22, letterSpacing: -0.3, fontFamily: fonts.sansSemi },
  footnote: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  account: { padding: 16, gap: 10 },
  docRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  docText: { fontSize: 15, fontFamily: fonts.sans },
})
