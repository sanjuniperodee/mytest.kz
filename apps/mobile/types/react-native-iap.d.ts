declare module "react-native-iap" {
  export function initConnection(): Promise<boolean>
  export function requestSubscription(input: { sku: string } | string): Promise<unknown>
  export function finishTransaction(input: { purchase: unknown; isConsumable?: boolean } | unknown): Promise<void>
}

