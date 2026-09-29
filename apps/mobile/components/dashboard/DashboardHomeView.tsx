import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import useSWR from "swr"
import { AdmissionGoalCard } from "@/components/dashboard/AdmissionGoalCard"
import { SessionStatusBadge } from "@/components/dashboard/SessionStatusBadge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Screen } from "@/components/ui/screen"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/api/auth-context"
import { localize } from "@/lib/api/i18n"
import type { ExamType, MistakesSummary, PaginatedResponse, SessionListItem, UserExamStats, UserStats } from "@/lib/api/types"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

type Sessions = PaginatedResponse<SessionListItem> | SessionListItem[]
const sessionsOf = (data?: Sessions) => (Array.isArray(data) ? data : (data?.items ?? []))

function formatBestPoints(item: UserExamStats): string {
  if (item.bestRawScore != null && item.bestMaxScore != null) return `${item.bestRawScore}/${item.bestMaxScore}`
  if (item.bestScore != null) return `${Math.round(item.bestScore)}%`
  return "—"
}

/** Home: one clear next step, results at a glance, recent attempts and the admission goal. */
export function DashboardHomeView() {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { locale } = useUiLocale()
  const { user } = useAuth()

  const stats = useSWR<UserStats>("/users/me/stats")
  const summary = useSWR<MistakesSummary>("/tests/mistakes/summary")
  const recent = useSWR<Sessions>("/tests/sessions?page=1&limit=4")
  // An unfinished attempt may be older than the four recent sessions.
  const active = useSWR<Sessions>("/tests/sessions?page=1&limit=1&status=in_progress")
  const exams = useSWR<ExamType[]>("/exams/types")
  const requests = [stats, summary, recent, active, exams]
  const failed = requests.some((r) => r.error)
  const reload = () => Promise.allSettled(requests.map((r) => r.mutate()))

  const name = user?.firstName || user?.telegramUsername || user?.username
  const sessions = sessionsOf(recent.data)
  const inProgress = sessionsOf(active.data)[0] ?? sessions.find((s) => s.status === "in_progress")
  const ent = exams.data?.find((e) => e.slug === "ent")
  const access = user?.accessByExam?.find((a) => a.examSlug === "ent")
  const freeRemaining = user?.trialStatus?.ent.freeRemaining ?? user?.trialStatus?.ent.remaining ?? 0
  const paid = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const dailyLimit = access?.reasonCode === "DAILY_LIMIT_REACHED"
  const needsAccess = access?.hasAccess === false && !dailyLimit
  const examHref = ent ? `/dashboard/exams/${ent.id}` : "/dashboard/exams"
  const startHref = needsAccess ? "/dashboard/billing?reason=no_access" : examHref
  const openMistakes = summary.data?.openTotal ?? 0
  const entStats = stats.data?.byExamType?.find((e) => e.examSlug === "ent")
  const impact = summary.data?.scoreImpact
  const completed = stats.data?.completedTests

  const next = inProgress
    ? {
        title: tr("Продолжите начатый пробный", "Бастаған сынақты жалғастырыңыз"),
        text: tr("Ответы сохранены. Вернитесь к тесту, который ещё не завершён.", "Жауаптар сақталған. Әлі аяқталмаған тестке оралыңыз."),
        label: tr("Продолжить пробный", "Сынақты жалғастыру"),
        href: `/exam/${inProgress.id}`,
      }
    : active.error
      ? {
          title: tr("Продолжим подготовку", "Дайындықты жалғастырайық"),
          text: tr("Не удалось проверить незавершённые попытки. Их можно найти в истории.", "Аяқталмаған әрекеттерді тексеру мүмкін болмады. Оларды тарихтан табуға болады."),
          label: tr("Открыть историю", "Тарихты ашу"),
          href: "/dashboard/history",
        }
      : openMistakes > 0
        ? {
            title: tr("Разберите ошибки перед новым тестом", "Жаңа тестке дейін қателерді талдаңыз"),
            text: tr(
              `В работе ${openMistakes} ошибок. Начните с одной темы и закрепите её тренировкой.`,
              `Қателер саны: ${openMistakes}. Бір тақырыптан бастап, жаттығумен бекітіңіз.`,
            ),
            label: tr("Работать над ошибками", "Қателермен жұмыс істеу"),
            href: "/dashboard/mistakes",
          }
        : dailyLimit
          ? {
              title: tr("Лимит пробных на сегодня исчерпан", "Бүгінгі сынақтар лимиті таусылды"),
              text: tr("Пока можно вернуться к решениям и повторить пройденные темы.", "Әзірге шешімдерді қарап, өткен тақырыптарды қайталауға болады."),
              label: tr("Посмотреть результаты", "Нәтижелерді көру"),
              href: "/dashboard/history",
            }
          : needsAccess
            ? {
                title: tr("Выберите доступ к следующему пробному", "Келесі сынаққа қолжетімділікті таңдаңыз"),
                text: tr("Предыдущие результаты остаются в истории. Для новой попытки выберите подходящий пакет.", "Алдыңғы нәтижелер тарихта сақталады. Жаңа әрекет үшін қолайлы пакетті таңдаңыз."),
                label: tr("Посмотреть пакеты", "Пакеттерді көру"),
                href: startHref,
              }
            : {
                title:
                  !paid && freeRemaining > 0
                    ? tr("Начните с бесплатного пробного", "Тегін сынақтан бастаңыз")
                    : tr("Проверьте себя на новом пробном", "Жаңа сынақта өзіңізді тексеріңіз"),
                text: tr("Узнайте свой результат и темы, которым стоит уделить внимание. Выберите предметы перед началом.", "Нәтижеңізді және назар аудару керек тақырыптарды біліңіз. Бастамас бұрын пәндерді таңдаңыз."),
                label: tr("Выбрать пробный", "Сынақты таңдау"),
                href: startHref,
              }
  const actionLoading = active.isLoading || summary.isLoading || exams.isLoading

  const tariff =
    localize(user?.currentTariff?.name, locale) ||
    (paid ? tr("Платный доступ", "Ақылы қолжетімділік") : tr("Стартовый доступ", "Бастапқы қолжетімділік"))
  const remaining = !access ? "—" : access.total.isUnlimited ? tr("Без лимита", "Шектеусіз") : String(access.total.remaining ?? "—")
  const finite = access ? [access.total, access.daily].filter((l) => !l.isUnlimited) : []
  const today = !access
    ? "—"
    : finite.length === 0
      ? tr("Без лимита", "Шектеусіз")
      : finite.some((l) => l.remaining == null)
        ? "—"
        : String(Math.max(0, Math.min(...finite.map((l) => l.remaining!))))

  const results: [string, string | number][] = [
    [tr("Завершено пробных", "Аяқталған сынақтар"), completed ?? "—"],
    [tr("Лучший результат ЕНТ", "ҰБТ-дағы үздік нәтиже"), entStats ? formatBestPoints(entStats) : "—"],
    [tr("Средний результат всех тестов", "Барлық тесттердің орташа нәтижесі"), completed && stats.data ? `${Math.round(stats.data.averageScore)}%` : "—"],
  ]
  const links = [
    { href: "/dashboard/stats", icon: "trending-up" as const, title: tr("Мой прогресс", "Менің жетістігім"), text: tr("Динамика результатов по предметам", "Пәндер бойынша нәтижелер динамикасы") },
    { href: "/dashboard/community", icon: "message-outline" as const, title: tr("Сообщество", "Қауымдастық"), text: tr("Обсуждения и помощь с подготовкой", "Талқылаулар мен дайындыққа көмек") },
    { href: "/dashboard/leaderboard", icon: "trophy-outline" as const, title: tr("Лидерборд", "Көшбасшылар"), text: tr("Результаты других участников", "Басқа қатысушылардың нәтижелері") },
  ]
  const streak = stats.data?.weeklyStreak ?? 0
  const dateLocale = locale === "kk" ? "kk-KZ" : "ru-RU"

  return (
    <Screen onRefresh={() => void reload()} refreshing={false}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{tr("МОЯ ПОДГОТОВКА", "МЕНІҢ ДАЙЫНДЫҒЫМ")}</Text>
          <Text accessibilityRole="header" style={[styles.h1, { color: colors.foreground }]}>
            {tr("Привет", "Сәлем")}
            {name ? `, ${name}` : ""}!
          </Text>
        </View>
        {streak > 0 ? (
          <View style={[styles.streak, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="fire" size={15} color="#F97316" />
            <Text style={[styles.small, { color: colors.mutedForeground }]}>
              {streak} {tr("нед. подряд", "апта қатарынан")}
            </Text>
          </View>
        ) : null}
      </View>

      {failed ? (
        <View accessibilityRole="alert" style={[styles.alert, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.text, { color: colors.foreground }]}>
            {tr("Часть данных не загрузилась. Доступные разделы продолжают работать.", "Кейбір деректер жүктелмеді. Қолжетімді бөлімдер жұмыс істейді.")}
          </Text>
          <Button variant="outline" size="sm" onPress={() => void reload()}>
            {tr("Повторить загрузку", "Қайта жүктеу")}
          </Button>
        </View>
      ) : null}

      <Card padded={false}>
        <View style={styles.next}>
          <View style={styles.eyebrowRow}>
            <MaterialCommunityIcons name="target" size={16} color={colors.mutedForeground} />
            <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Следующий шаг", "Келесі қадам")}</Text>
          </View>
          {actionLoading ? (
            <View style={styles.skeletons}>
              <Skeleton height={26} width="75%" />
              <Skeleton height={40} />
              <Skeleton height={44} width={180} radius={10} />
            </View>
          ) : (
            <>
              <Text style={[styles.h2, { color: colors.foreground }]}>{next.title}</Text>
              <Text style={[styles.text, { color: colors.mutedForeground }]}>{next.text}</Text>
              <Button onPress={() => router.push(next.href as never)} icon={(c) => <MaterialCommunityIcons name="arrow-right" size={17} color={c} />}>
                {next.label}
              </Button>
            </>
          )}
        </View>
        <View style={[styles.access, { borderTopColor: colors.border, backgroundColor: colors.secondary }]}>
          <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Ваш доступ", "Сіздің қолжетімділігіңіз")}</Text>
          <Text style={[styles.tariff, { color: colors.foreground }]}>{tariff}</Text>
          <View style={styles.kv}>
            <Text style={[styles.text, { color: colors.mutedForeground }]}>{tr("Попыток осталось", "Қалған әрекеттер")}</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>{remaining}</Text>
          </View>
          <View style={styles.kv}>
            <Text style={[styles.text, { color: colors.mutedForeground }]}>{tr("Можно сегодня", "Бүгін қолжетімді")}</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>{today}</Text>
          </View>
          <Pressable accessibilityRole="link" onPress={() => router.push("/dashboard/billing" as never)} style={styles.linkRow}>
            <Text style={[styles.link, { color: colors.foreground }]}>{tr("Управлять доступом", "Қолжетімділікті басқару")}</Text>
            <MaterialCommunityIcons name="arrow-right" size={13} color={colors.foreground} />
          </Pressable>
        </View>
      </Card>

      <Card padded={false}>
        {results.map(([label, value], i) => (
          <View key={label} style={[styles.result, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.small, styles.flex, { color: colors.mutedForeground }]}>{label}</Text>
            {stats.isLoading ? <Skeleton height={24} width={64} /> : <Text style={[styles.resultValue, { color: colors.foreground }]}>{value}</Text>}
          </View>
        ))}
      </Card>

      <Card padded={false}>
        <View style={styles.cardHead}>
          <Text style={[styles.h3, { color: colors.foreground }]}>{tr("Последние пробные", "Соңғы сынақтар")}</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push("/dashboard/history" as never)} style={styles.linkRow}>
            <Text style={[styles.link, { color: colors.foreground }]}>{tr("Вся история", "Барлық тарих")}</Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color={colors.foreground} />
          </Pressable>
        </View>
        {recent.isLoading ? (
          <View style={styles.pad}>
            <Skeleton height={56} radius={10} />
            <Skeleton height={56} radius={10} />
          </View>
        ) : recent.error && !recent.data ? (
          <Text style={[styles.text, styles.pad, { color: colors.mutedForeground }]}>
            {tr("История временно недоступна. Попробуйте обновить данные.", "Тарих уақытша қолжетімсіз. Деректерді жаңартып көріңіз.")}
          </Text>
        ) : sessions.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.value, { color: colors.foreground }]}>{tr("Здесь появятся ваши результаты", "Нәтижелеріңіз осында пайда болады")}</Text>
            <Text style={[styles.text, { color: colors.mutedForeground }]}>
              {tr("После первого пробного вы сможете открыть разбор ответов и сравнивать попытки.", "Бірінші сынақтан кейін жауаптарды талдап, әрекеттерді салыстыра аласыз.")}
            </Text>
          </View>
        ) : (
          sessions.map((s) => {
            const finished = s.status === "completed" || s.status === "timed_out"
            const href = s.status === "in_progress" ? `/exam/${s.id}` : finished ? `/exam/${s.id}/review` : "/dashboard/history"
            const points =
              finished && s.rawScore != null && s.maxScore != null
                ? `${s.rawScore}/${s.maxScore}`
                : finished && s.score != null
                  ? `${Math.round(s.score)}%`
                  : ""
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                onPress={() => router.push(href as never)}
                style={[styles.session, { borderTopColor: colors.border }]}
              >
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={[styles.value, { color: colors.foreground }]}>
                    {localize(s.examType?.name, locale) || tr("Пробный тест", "Сынақ тесті")}
                  </Text>
                  <View style={styles.sessionMeta}>
                    <Text style={[styles.small, { color: colors.mutedForeground }]}>
                      {s.startedAt ? new Date(s.startedAt).toLocaleDateString(dateLocale, { day: "numeric", month: "short" }) : "—"}
                    </Text>
                    <SessionStatusBadge status={s.status} />
                  </View>
                </View>
                <Text style={[styles.value, { color: colors.foreground }]}>{points}</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            )
          })
        )}
      </Card>

      <AdmissionGoalCard currentScore={impact?.available ? impact.lastScore : null} />

      <View style={styles.links}>
        {links.map((l) => (
          <Pressable
            key={l.href}
            accessibilityRole="button"
            onPress={() => router.push(l.href as never)}
            style={[styles.link3, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <MaterialCommunityIcons name={l.icon} size={17} color={colors.mutedForeground} style={styles.linkIcon} />
            <View style={styles.flex}>
              <Text style={[styles.value, { color: colors.foreground }]}>{l.title}</Text>
              <Text style={[styles.small, { color: colors.mutedForeground }]}>{l.text}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  eyebrow: { fontSize: 11, letterSpacing: 0.8, fontFamily: fonts.sansSemi },
  h1: { fontSize: 28, lineHeight: 34, letterSpacing: -0.5, fontFamily: fonts.sansSemi, marginTop: 4 },
  h2: { fontSize: 21, lineHeight: 27, letterSpacing: -0.3, fontFamily: fonts.sansSemi },
  h3: { fontSize: 16, fontFamily: fonts.sansSemi },
  streak: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  small: { fontSize: 12, lineHeight: 17 },
  text: { fontSize: 14, lineHeight: 21 },
  value: { fontSize: 14, fontFamily: fonts.sansSemi },
  alert: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 10, alignItems: "flex-start" },
  next: { padding: 18, gap: 12 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  skeletons: { gap: 12 },
  access: { borderTopWidth: StyleSheet.hairlineWidth, padding: 18, gap: 8 },
  tariff: { fontSize: 16, fontFamily: fonts.sansSemi },
  kv: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 },
  link: { fontSize: 13, fontFamily: fonts.sansSemi },
  result: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  resultValue: { fontSize: 20, fontFamily: fonts.sansSemi },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 16, paddingBottom: 8 },
  pad: { padding: 16, gap: 10 },
  empty: { margin: 16, marginTop: 4, borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 16, gap: 8 },
  session: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  sessionMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  links: { gap: 10 },
  link3: { flexDirection: "row", gap: 12, alignItems: "flex-start", borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
  linkIcon: { marginTop: 2 },
})
