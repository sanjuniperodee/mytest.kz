import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useColorScheme as useOsScheme } from "react-native"
import { darkColors, lightColors, type ThemeColors } from "./colors"

const STORAGE_KEY = "mytest-theme"

export type ThemePreference = "light" | "dark" | "system"

type ThemeContextValue = {
  preference: ThemePreference
  resolved: "light" | "dark"
  colors: ThemeColors
  setPreference: (v: ThemePreference) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const os = useOsScheme()
  const [preference, setPrefState] = useState<ThemePreference>("system")

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === "light" || raw === "dark" || raw === "system") {
        setPrefState(raw)
      }
    })
  }, [])

  const resolved: "light" | "dark" =
    preference === "system" ? (os === "dark" ? "dark" : "light") : preference

  const setPreference = useCallback((v: ThemePreference) => {
    setPrefState(v)
    void AsyncStorage.setItem(STORAGE_KEY, v)
  }, [])

  const toggle = useCallback(() => {
    const next = resolved === "dark" ? "light" : "dark"
    setPreference(next)
  }, [resolved, setPreference])

  const colors = resolved === "dark" ? darkColors : lightColors

  const value = useMemo(
    () => ({
      preference,
      resolved,
      colors,
      setPreference,
      toggle,
    }),
    [colors, preference, resolved, setPreference, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider")
  return ctx
}
