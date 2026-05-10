import { DrawerActions, useNavigation } from "@react-navigation/native"
import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { usePathname } from "expo-router"
import { useTopInset } from "@/lib/use-top-inset"
import { dashboardScreenTitle, t, useUiLocale } from "@/lib/i18n/ui"
import { useAppTheme } from "@/lib/theme/provider"

export function MobileHeader({ title }: { title?: string }) {
  const { colors } = useAppTheme()
  const topInset = useTopInset()
  const navigation = useNavigation()
  const { locale } = useUiLocale()
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
          style={[styles.iconBtn, { borderColor: colors.border }]}
        >
          <Text style={{ fontSize: 18, color: colors.foreground }}>☰</Text>
        </Pressable>
        <Text
          style={[styles.title, isBrand && styles.titleBrand, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {resolvedTitle}
        </Text>
        <View style={{ width: 40 }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    marginHorizontal: 8,
  },
  titleBrand: {
    textTransform: "lowercase",
  },
})
