import { DrawerActions, useNavigation } from "@react-navigation/native"
import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { usePathname } from "expo-router"
import { useTopInset } from "@/lib/use-top-inset"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { fonts } from "@/lib/theme/fonts"
import { dashboardScreenTitle, t, useUiLocale } from "@/lib/i18n/ui"
import { useAppTheme } from "@/lib/theme/provider"

export function MobileHeader({ title }: { title?: string }) {
  const { colors } = useAppTheme()
  const topInset = useTopInset()
  const navigation = useNavigation()
  const { locale, setLocale } = useUiLocale()
  const pathname = usePathname()

  const resolvedTitle = useMemo(
    () => title ?? dashboardScreenTitle(pathname || "/dashboard", locale),
    [title, pathname, locale],
  )
  const isBrand = resolvedTitle === "mytest"

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer())
  }

  return (
    <View
      style={[
        styles.shell,
        {
          paddingTop: topInset,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
          zIndex: 50,
          elevation: 50,
        },
      ]}
    >
      <View style={styles.bar}>
        <Pressable
          accessibilityLabel={t("openMenu", locale)}
          hitSlop={12}
          onPress={openDrawer}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons name="menu" size={22} color={colors.foreground} />
        </Pressable>
        {isBrand ? (
          <View style={styles.brandLockup}>
            <View style={[styles.brandMark, { backgroundColor: colors.foreground }]}>
              <MaterialCommunityIcons
                name="star-four-points-small"
                size={16}
                color={colors.background}
              />
            </View>
            <Text style={[styles.title, styles.titleBrand, { color: colors.foreground }]} numberOfLines={1}>
              mytest
            </Text>
          </View>
        ) : (
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {resolvedTitle}
          </Text>
        )}
        <Pressable
          accessibilityLabel={t("language", locale)}
          hitSlop={12}
          onPress={() => setLocale(locale === "ru" ? "kk" : "ru")}
          style={styles.langBtn}
        >
          <Text style={[styles.langText, { color: colors.mutedForeground }]}>{locale.toUpperCase()}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLockup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.sansSemi,
    letterSpacing: -0.2,
  },
  titleBrand: {
    textTransform: "lowercase",
  },
  langBtn: {
    minWidth: 44,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  langText: {
    fontSize: 13,
    fontFamily: fonts.sansSemi,
  },
})
