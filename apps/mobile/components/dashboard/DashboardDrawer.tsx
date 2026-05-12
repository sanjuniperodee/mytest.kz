import type { DrawerContentComponentProps } from "@react-navigation/drawer"
import { DrawerContentScrollView } from "@react-navigation/drawer"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import useSWR from "swr"
import { Image } from "react-native"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { router, usePathname } from "expo-router"
import { useAuth } from "@/lib/api/auth-context"
import { resolveMediaUrl } from "@/lib/api/client"
import { useLocation } from "@/lib/location"
import type { SessionListItem } from "@/lib/api/types"
import { useTopInset } from "@/lib/use-top-inset"
import { localize, type Locale } from "@/lib/api/i18n"
import { fonts } from "@/lib/theme/fonts"
import { useUiLocale, t } from "@/lib/i18n/ui"
import { useAppTheme } from "@/lib/theme/provider"

/** Порядок як у веб DashboardShell + «Динамика ЕНТ» після лідерборду. */
const ROUTES: {
  href: `/dashboard${string}`
  labelKey: string
  icon: keyof typeof MaterialCommunityIcons.glyphMap
}[] = [
  { href: "/dashboard", labelKey: "overview", icon: "view-grid-outline" },
  { href: "/dashboard/exams", labelKey: "exams", icon: "book-open-page-variant-outline" },
  { href: "/dashboard/mistakes", labelKey: "mistakes", icon: "target" },
  { href: "/dashboard/admission", labelKey: "admission", icon: "school-outline" },
  { href: "/dashboard/leaderboard", labelKey: "leaderboard", icon: "trophy-outline" },
  { href: "/dashboard/stats", labelKey: "stats", icon: "chart-line" },
  { href: "/dashboard/billing", labelKey: "billing", icon: "credit-card-outline" },
  { href: "/dashboard/profile", labelKey: "profile", icon: "account-circle-outline" },
]

export function DashboardDrawerContent(props: DrawerContentComponentProps) {
  const topInset = useTopInset()
  const { colors, resolved } = useAppTheme()
  const { user, signOut } = useAuth()
  const { isInKZ } = useLocation()
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
        <Pressable
          onPress={() => {
            router.push("/dashboard")
            props.navigation.closeDrawer()
          }}
          style={styles.brandRow}
        >
          <View style={[styles.brandMark, { backgroundColor: colors.foreground }]}>
            <MaterialCommunityIcons
              name="star-four-points-small"
              size={18}
              color={colors.background}
            />
          </View>
          <View style={styles.brandCopy}>
            <Text style={[styles.brandText, { color: colors.foreground }]}>mytest</Text>
            <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>
              my-test.kz
            </Text>
          </View>
        </Pressable>

        <View
          style={[
            styles.langSwitch,
            { borderColor: colors.border, backgroundColor: colors.secondary },
          ]}
        >
          {(["ru", "kk"] as const).map((lang) => {
            const active = uiLocale === lang
            return (
              <Pressable
                key={lang}
                onPress={() => {
                  if (!active) cycleUiLang()
                }}
                style={[
                  styles.langOption,
                  active ? { backgroundColor: colors.foreground } : null,
                ]}
              >
                <Text
                  style={[
                    styles.langOptionText,
                    { color: active ? colors.background : colors.foreground },
                  ]}
                >
                  {lang.toUpperCase()}
                </Text>
              </Pressable>
            )
          })}
        </View>
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
        {ROUTES.filter((r) => {
          if (r.href === "/dashboard/billing" && (isInKZ === false || user?.email === "apple-review@my-test.kz")) return false
          return true
        }).map((item) => {
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
                {
                  backgroundColor: focused ? colors.foreground : "transparent",
                },
              ]}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={20}
                color={focused ? colors.background : colors.foreground}
              />
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
          style={[
            styles.profileRow,
            {
              borderColor: colors.border,
              backgroundColor: colors.secondary,
            },
          ]}
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
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={() => {
            signOut()
            props.navigation.closeDrawer()
            router.replace("/landing")
          }}
          style={[styles.logout, { backgroundColor: colors.secondary }]}
        >
          <MaterialCommunityIcons name="logout" size={18} color={colors.mutedForeground} />
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
    gap: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  brandCopy: {
    flex: 1,
  },
  brandText: {
    fontSize: 20,
    fontFamily: fonts.sansSemi,
    letterSpacing: -0.5,
    textTransform: "lowercase",
  },
  brandSub: {
    fontSize: 12,
    marginTop: 2,
  },
  langSwitch: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
  },
  langOption: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  langOptionText: {
    fontSize: 13,
    fontFamily: fonts.sansSemi,
  },
  nav: {
    paddingVertical: 8,
    gap: 4,
    paddingHorizontal: 8,
  },
  navRow: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.sansSemi,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    minHeight: 44,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
