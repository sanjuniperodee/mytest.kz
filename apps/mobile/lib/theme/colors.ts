/**
 * Light/dark palettes aligned with apps/web/app/globals.css (oklch → hex approx).
 */
export const lightColors = {
  background: "#F7F6F3",
  foreground: "#2A2826",
  card: "#FFFFFF",
  cardForeground: "#2A2826",
  mutedForeground: "#6E6863",
  secondary: "#EDEAE4",
  secondaryForeground: "#2A2826",
  border: "#DBD6CF",
  accent: "#E06050",
  accentForeground: "#FFFDFB",
  destructive: "#DC2626",
  destructiveForeground: "#FAFAFA",
  ring: "#E06050",
}

export const darkColors = {
  background: "#242220",
  foreground: "#F5F3EF",
  card: "#2E2C29",
  cardForeground: "#F5F3EF",
  mutedForeground: "#B5AEA5",
  secondary: "#3A3834",
  secondaryForeground: "#F5F3EF",
  border: "#45423D",
  accent: "#EB7A6A",
  accentForeground: "#1E1C1A",
  destructive: "#EF4444",
  destructiveForeground: "#FAFAFA",
  ring: "#EB7A6A",
}

export type ThemeColors = typeof lightColors
