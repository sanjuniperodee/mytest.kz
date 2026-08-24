import { Platform } from "react-native"

export const STORE_PRODUCTS: Record<string, string> = {
  starter: "com.sanjuniperodee.mobile.premium.trial",
  basic: "com.sanjuniperodee.mobile.premium.week",
  pro: "com.sanjuniperodee.mobile.premium.annual",
  premium: "com.sanjuniperodee.mobile.premium.month",
}

export const STORE_PRODUCT_IDS = Object.values(STORE_PRODUCTS)

export function isStoreBillingAvailable() {
  return Platform.OS === "ios" || Platform.OS === "android"
}

export function storeName() {
  return Platform.OS === "ios" ? "App Store" : "Google Play"
}
