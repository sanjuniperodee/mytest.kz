import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native"
import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect, useMemo } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { SWRConfig } from "swr"
import { AuthProvider } from "@/lib/api/auth-context"
import { fetcher } from "@/lib/api/swr-config"
import { UiLocaleProvider } from "@/lib/i18n/ui"
import { LocationProvider } from "@/lib/location"
import { ThemeProvider, useAppTheme } from "@/lib/theme/provider"
import { fontAssets } from "@/lib/theme/fonts"

export { ErrorBoundary } from "expo-router"

SplashScreen.preventAutoHideAsync()

function NavShell({ children }: { children: React.ReactNode }) {
  const { colors, resolved } = useAppTheme()
  const navTheme = useMemo(
    () =>
      resolved === "dark"
        ? {
            ...NavDarkTheme,
            colors: {
              ...NavDarkTheme.colors,
              primary: colors.foreground,
              background: colors.background,
              card: colors.card,
              text: colors.foreground,
              border: colors.border,
              notification: colors.accent,
            },
          }
        : {
            ...NavDefaultTheme,
            colors: {
              ...NavDefaultTheme.colors,
              primary: colors.foreground,
              background: colors.background,
              card: colors.card,
              text: colors.foreground,
              border: colors.border,
              notification: colors.accent,
            },
          },
    [colors, resolved],
  )

  return (
    <NavigationThemeProvider value={navTheme}>
      <SWRConfig value={{ fetcher }}>{children}</SWRConfig>
    </NavigationThemeProvider>
  )
}

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets)

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync()
    }
  }, [loaded])

  if (!loaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LocationProvider>
          <AuthProvider>
            <UiLocaleProvider>
              <NavShell>
                <Stack screenOptions={{ headerShown: false }} />
              </NavShell>
            </UiLocaleProvider>
          </AuthProvider>
          </LocationProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
