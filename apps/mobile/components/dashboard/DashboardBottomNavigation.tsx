import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router, usePathname } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "@/lib/api/auth-context"
import { resolveMediaUrl } from "@/lib/api/client"
import { localize, type Locale } from "@/lib/api/i18n"
import { t, useUiLocale } from "@/lib/i18n/ui"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

type RouteItem = {
  href: `/dashboard${string}`
  label: { ru: string; kk: string }
  icon: keyof typeof MaterialCommunityIcons.glyphMap
}

const PRIMARY: RouteItem[] = [
  { href: "/dashboard", label: { ru: "Обзор", kk: "Шолу" }, icon: "home-outline" },
  { href: "/dashboard/exams", label: { ru: "Тесты", kk: "Тесттер" }, icon: "book-open-page-variant-outline" },
  { href: "/dashboard/mistakes", label: { ru: "Ошибки", kk: "Қателер" }, icon: "target" },
  { href: "/dashboard/admission", label: { ru: "Грант", kk: "Грант" }, icon: "school-outline" },
]

const SECONDARY: RouteItem[] = [
  { href: "/dashboard/leaderboard", label: { ru: "Лидерборд", kk: "Көшбасшылар" }, icon: "trophy-outline" },
  { href: "/dashboard/stats", label: { ru: "Статистика", kk: "Статистика" }, icon: "chart-line" },
  { href: "/dashboard/history", label: { ru: "История", kk: "Тарих" }, icon: "history" },
  { href: "/dashboard/billing", label: { ru: "Тарифы", kk: "Тарифтер" }, icon: "credit-card-outline" },
]

function routeIsActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function DashboardBottomNavigation() {
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { locale: ui, setLocale } = useUiLocale()
  const [moreOpen, setMoreOpen] = useState(false)
  const isMoreRoute = !PRIMARY.some((item) => routeIsActive(pathname, item.href))
  const locale = ((user?.preferredLanguage as Locale) || ui) as Locale
  const displayName = useMemo(() =>
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    localize(user?.fullName, locale) || user?.username || user?.phone || "Профиль",
  [locale, user])
  const initials = displayName.slice(0, 2).toUpperCase()
  const avatarUri = resolveMediaUrl(user?.avatarUrl ?? null)

  useEffect(() => setMoreOpen(false), [pathname])

  const navigate = (href: RouteItem["href"]) => {
    setMoreOpen(false)
    router.push(href as never)
  }

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(7, insets.bottom), borderTopColor: colors.border, backgroundColor: colors.background }]}> 
        {PRIMARY.map((item) => {
          const active = routeIsActive(pathname, item.href)
          return (
            <Pressable key={item.href} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => navigate(item.href)} style={[styles.tab, active && { backgroundColor: `${colors.accent}14` }]}> 
              <MaterialCommunityIcons name={item.icon} size={21} color={active ? colors.accent : colors.mutedForeground} />
              <Text numberOfLines={1} style={[styles.tabLabel, { color: active ? colors.accent : colors.mutedForeground }]}>{item.label[ui]}</Text>
            </Pressable>
          )
        })}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: moreOpen, selected: isMoreRoute }} onPress={() => setMoreOpen(true)} style={[styles.tab, (moreOpen || isMoreRoute) && { backgroundColor: `${colors.accent}14` }]}> 
          <MaterialCommunityIcons name="dots-horizontal" size={22} color={moreOpen || isMoreRoute ? colors.accent : colors.mutedForeground} />
          <Text style={[styles.tabLabel, { color: moreOpen || isMoreRoute ? colors.accent : colors.mutedForeground }]}>{ui === "kk" ? "Тағы" : "Ещё"}</Text>
        </Pressable>
      </View>

      <Modal visible={moreOpen} transparent animationType="slide" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMoreOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom), backgroundColor: colors.card, borderColor: colors.border }]} onPress={(event) => event.stopPropagation()}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{ui === "kk" ? "Тағы" : "Ещё"}</Text>
            <Text style={[styles.sheetLead, { color: colors.mutedForeground }]}>{ui === "kk" ? "Аккаунт және қосымша бөлімдер" : "Аккаунт и дополнительные разделы"}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable onPress={() => navigate("/dashboard/profile")} style={[styles.profile, { backgroundColor: colors.secondary }]}> 
                {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.profileAvatar} /> : <View style={[styles.profileAvatar, styles.profileFallback, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground, fontFamily: fonts.sansSemi }}>{initials}</Text></View>}
                <View style={styles.profileCopy}><Text numberOfLines={1} style={[styles.profileName, { color: colors.foreground }]}>{displayName}</Text><Text numberOfLines={1} style={[styles.profileSub, { color: colors.mutedForeground }]}>{user?.phone || user?.telegramUsername || (ui === "kk" ? "Аккаунт баптаулары" : "Настройки аккаунта")}</Text></View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground} />
              </Pressable>
              <View style={styles.routes}>
                {SECONDARY.map((item) => {
                  const active = routeIsActive(pathname, item.href)
                  return <Pressable key={item.href} onPress={() => navigate(item.href)} style={[styles.route, active && { backgroundColor: colors.foreground }]}><View style={[styles.routeIcon, { backgroundColor: active ? `${colors.background}22` : colors.secondary }]}><MaterialCommunityIcons name={item.icon} size={19} color={active ? colors.background : colors.foreground} /></View><Text style={[styles.routeLabel, { color: active ? colors.background : colors.foreground }]}>{item.label[ui]}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={active ? colors.background : colors.mutedForeground} /></Pressable>
                })}
              </View>
              <View style={[styles.language, { borderColor: colors.border }]}><Text style={[styles.routeLabel, { color: colors.foreground }]}>{t("language", ui)}</Text><View style={[styles.languageSwitch, { backgroundColor: colors.secondary }]}>{(["ru", "kk"] as const).map((lang) => <Pressable key={lang} onPress={() => setLocale(lang)} style={[styles.languageChoice, ui === lang && { backgroundColor: colors.foreground }]}><Text style={{ color: ui === lang ? colors.background : colors.foreground, fontFamily: fonts.sansSemi, fontSize: 12 }}>{lang.toUpperCase()}</Text></Pressable>)}</View></View>
              <Pressable onPress={() => { setMoreOpen(false); void signOut(); router.replace("/landing") }} style={styles.logout}><MaterialCommunityIcons name="logout" size={19} color={colors.mutedForeground} /><Text style={[styles.routeLabel, { color: colors.mutedForeground }]}>{t("logout", ui)}</Text></Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 6, paddingTop: 6 },
  tab: { flex: 1, minHeight: 49, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 2 },
  tabLabel: { fontSize: 10, fontFamily: fonts.sansSemi },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.42)" },
  sheet: { maxHeight: "85%", borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 14, paddingTop: 9 },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 10 },
  sheetTitle: { fontSize: 21, fontFamily: fonts.sansSemi, paddingHorizontal: 6 },
  sheetLead: { fontSize: 13, marginTop: 2, marginBottom: 14, paddingHorizontal: 6 },
  profile: { flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, padding: 12, marginBottom: 10 },
  profileAvatar: { width: 44, height: 44, borderRadius: 22 },
  profileFallback: { alignItems: "center", justifyContent: "center" },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 14, fontFamily: fonts.sansSemi },
  profileSub: { fontSize: 12, marginTop: 2 },
  routes: { gap: 4 },
  route: { minHeight: 52, borderRadius: 13, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 11 },
  routeIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  routeLabel: { flex: 1, fontSize: 14, fontFamily: fonts.sansSemi },
  language: { marginTop: 10, minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  languageSwitch: { flexDirection: "row", borderRadius: 9, padding: 3 },
  languageChoice: { minWidth: 39, height: 31, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  logout: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 12, marginTop: 4 },
})
