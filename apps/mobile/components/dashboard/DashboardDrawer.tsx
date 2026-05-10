import type { DrawerContentComponentProps } from "@react-navigation/drawer"
import { DrawerContentScrollView } from "@react-navigation/drawer"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import useSWR from "swr"
import { Image } from "react-native"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { router, usePathname } from "expo-router"
import { useAuth } from "@/lib/api/auth-context"
import { resolveMediaUrl } from "@/lib/api/client"
import type { SessionListItem } from "@/lib/api/types"
import { useTopInset } from "@/lib/use-top-inset"
import { localize, type Locale } from "@/lib/api/i18n"
import { useUiLocale, t } from "@/lib/i18n/ui"
import { useAppTheme } from "@/lib/theme/provider"

/** Порядок як у веб DashboardShell + «Динамика ЕНТ» після лідерборду. */
const ROUTES: { href: `/dashboard${string}`; labelKey: string }[] = [
  { href: "/dashboard", labelKey: "overview" },
  { href: "/dashboard/exams", labelKey: "exams" },
  { href: "/dashboard/mistakes", labelKey: "mistakes" },
  { href: "/dashboard/admission", labelKey: "admission" },
  { href: "/dashboard/leaderboard", labelKey: "leaderboard" },
  { href: "/dashboard/stats", labelKey: "stats" },
  { href: "/dashboard/billing", labelKey: "billing" },
  { href: "/dashboard/profile", labelKey: "profile" },
]

export function DashboardDrawerContent(props: DrawerContentComponentProps) {
  const topInset = useTopInset()
  const { colors, resolved } = useAppTheme()
  const { user, signOut } = useAuth()
  const { locale: uiLocale, setLocale } = useUiLocale()
  const pathname = usePathname()
  const navLocale = ((user?.preferredLanguage as Locale) || uiLocale || "ru") as Locale

  const firstLastName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
  const fullNameStr = firstLastName || localize(user?.fullName, navLocale)
  const displayName =
    fullNameStr || user?.telegramUsername || user?.username || user?.phone || "mytest"
  const initials = displayName.toString().slice(0, 2).toUpperCase()
  const avatarUri = resolveMediaUrl(user?.avatarUrl ?? null)

  const cycleUiLang = () => {
    setLocale(uiLocale === "ru" ? "kk" : "ru")
  }

  const { data: liveSessions } = useSWR<{ items: SessionListItem[] }>(
    "/tests/sessions?page=1&limit=10&status=in_progress",
  )
  const currentSession = liveSessions?.items?.[0]
  const currentExamTitle = currentSession
    ? localize(currentSession.examType?.name, navLocale, t("examFallbackName", uiLocale))
    : ""

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.scroll,
        {
          backgroundColor: colors.card,
          // Override DrawerContentScrollView paddingTop (12 + insets.top) for Android edge-to-edge fallback
          paddingTop: 12 + topInset,
        },
      ]}
    >
      <View style={[styles.brand, { borderBottomColor: colors.border }]}>
        <Text style={[styles.brandText, { color: colors.foreground }]}>mytest</Text>
        <Pressable
          onPress={cycleUiLang}
          style={[styles.langChip, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.foreground, fontWeight: "600" }}>
            {t("language", uiLocale)} · {uiLocale.toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {currentSession ? (
        <Pressable
          onPress={() => {
            router.push(`/exam/${currentSession.id}` as never)
            props.navigation.closeDrawer()
          }}
          style={[
            styles.currentExamCard,
            {
              borderColor: colors.border,
              backgroundColor: resolved === "dark" ? `${colors.accent}18` : `${colors.accent}14`,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${t("drawerCurrentExam", uiLocale)}: ${currentExamTitle}`}
        >
          <View style={[styles.currentExamAccent, { backgroundColor: colors.accent }]} />
          <View
            style={[
              styles.currentExamIconWrap,
              { backgroundColor: resolved === "dark" ? `${colors.accent}28` : `${colors.accent}22` },
            ]}
          >
            <MaterialCommunityIcons name="book-play-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.currentExamTextCol}>
            <Text style={[styles.currentExamKicker, { color: colors.accent }]}>
              {t("drawerCurrentExam", uiLocale)}
            </Text>
            <Text style={[styles.currentExamName, { color: colors.foreground }]} numberOfLines={2}>
              {currentExamTitle}
            </Text>
          </View>
          <View style={styles.currentExamCta}>
            <Text style={[styles.currentExamCtaLbl, { color: colors.foreground }]}>
              {t("homeContinue", uiLocale)}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.foreground} />
          </View>
        </Pressable>
      ) : null}

      <View style={styles.nav}>
        {ROUTES.map((item) => {
          const label = t(item.labelKey, uiLocale)
          const focused =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Pressable
              key={item.href}
              onPress={() => {
                router.push(item.href as never)
                props.navigation.closeDrawer()
              }}
              style={[
                styles.navRow,
                focused ? { backgroundColor: colors.foreground } : null,
              ]}
            >
              <Text
                style={[
                  styles.navLabel,
                  { color: focused ? colors.background : colors.foreground },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          style={styles.profileRow}
          onPress={() => {
            router.push("/dashboard/profile")
            props.navigation.closeDrawer()
          }}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.secondary }]}>
              <Text style={{ fontWeight: "700", color: colors.foreground }}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.foreground }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text
              style={[styles.profileSub, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {user?.phone || user?.telegramUsername || ""}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => {
            signOut()
            props.navigation.closeDrawer()
            router.replace("/landing")
          }}
          style={styles.logout}
        >
          <Text style={{ color: colors.mutedForeground, fontWeight: "600" }}>
            {t("logout", uiLocale)}
          </Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  brand: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  brandText: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
    textTransform: "lowercase",
  },
  langChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nav: {
    paddingVertical: 8,
    gap: 4,
    paddingHorizontal: 8,
  },
  navRow: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  navLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    marginTop: "auto",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    fontSize: 15,
    fontWeight: "600",
  },
  profileSub: {
    fontSize: 12,
    marginTop: 2,
  },
  logout: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  currentExamCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingRight: 12,
    overflow: "hidden",
  },
  currentExamAccent: {
    width: 4,
    alignSelf: "stretch",
    marginRight: 4,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  currentExamIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  currentExamTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  currentExamKicker: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  currentExamName: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  currentExamCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  currentExamCtaLbl: {
    fontSize: 13,
    fontWeight: "700",
  },
})
