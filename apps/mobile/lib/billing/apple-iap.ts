import { Platform } from "react-native"

export const APPLE_IAP_PRODUCTS: Record<string, string> = {
  trial: "com.sanjuniperodee.mobile.premium.trial",
  week: "com.sanjuniperodee.mobile.premium.week",
  month: "com.sanjuniperodee.mobile.premium.month",
  annual: "com.sanjuniperodee.mobile.premium.annual",
}

export function isAppleIapAvailable() {
  return Platform.OS === "ios"
}

