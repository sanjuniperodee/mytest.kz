import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif"
import {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope"

export const fontAssets = {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  InstrumentSerif_400Regular,
}

/** Loaded names match Expo Google Fonts exports (use as fontFamily). */
export const fonts = {
  sans: "Manrope_400Regular",
  sansSemi: "Manrope_600SemiBold",
  sansBold: "Manrope_700Bold",
  serif: "InstrumentSerif_400Regular",
} as const
