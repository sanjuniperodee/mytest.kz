declare module "react-native-iap" {
  export function initConnection(): Promise<boolean>
  export function requestPurchase(input: {
    type: "in-app" | "subs"
    request: {
      apple?: { sku: string }
      ios?: { sku: string }
      google?: { skus: string[] }
      android?: { skus: string[] }
    }
    useAlternativeBilling?: boolean
  }): Promise<unknown>
  export function finishTransaction(input: { purchase: unknown; isConsumable?: boolean } | unknown): Promise<void>
}
