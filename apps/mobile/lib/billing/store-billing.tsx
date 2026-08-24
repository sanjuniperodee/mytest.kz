import * as Crypto from "expo-crypto"
import { Platform } from "react-native"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useIAP, type Product, type Purchase, type PurchaseError } from "react-native-iap"
import { api, ApiError } from "@/lib/api/client"
import { STORE_PRODUCT_IDS, STORE_PRODUCTS, isStoreBillingAvailable, storeName } from "./store-products"

type StoreState = {
  available: boolean
  connected: boolean
  loading: boolean
  pending: boolean
  error: string | null
  name: string
  priceForPlan: (planId: string) => string | null
  purchase: (planId: string) => Promise<void>
  restore: () => Promise<void>
  clearError: () => void
}

const StoreBillingContext = createContext<StoreState | null>(null)

export function StoreBillingProvider({ userId, onVerified, children }: { userId?: string | null; onVerified: () => void | Promise<void>; children: ReactNode }) {
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const processorRef = useRef<(purchase: Purchase) => Promise<void>>(async () => undefined)

  const onPurchaseError = useCallback((purchaseError: PurchaseError) => {
    setLoading(false)
    if (String(purchaseError.code).toUpperCase().includes("CANCEL")) return
    setError(purchaseError.message || "STORE_PURCHASE_FAILED")
  }, [])

  const { connected, products, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => void processorRef.current(purchase),
    onPurchaseError,
    onError: (storeError) => setError(storeError.message),
  })

  const processPurchase = useCallback(async (purchase: Purchase) => {
    if (purchase.purchaseState === "pending") {
      setPending(true)
      setLoading(false)
      return
    }
    if (purchase.purchaseState !== "purchased") return
    const purchaseToken = purchase.purchaseToken
    if (!purchaseToken) {
      setLoading(false)
      setError("STORE_PURCHASE_TOKEN_MISSING")
      return
    }
    try {
      await api("/billing/store/verify", {
        method: "POST",
        body: {
          platform: Platform.OS,
          productId: purchase.productId,
          purchaseToken,
          transactionId: purchase.transactionId || purchase.id,
        },
      })
      // Google Play is consumed atomically by the backend. StoreKit transactions
      // must be finished on-device after the entitlement was persisted.
      if (Platform.OS === "ios") {
        await finishTransaction({ purchase, isConsumable: true })
      }
      setPending(false)
      setError(null)
      await onVerified()
    } catch (purchaseError) {
      setError(purchaseError instanceof ApiError ? purchaseError.message : purchaseError instanceof Error ? purchaseError.message : String(purchaseError))
    } finally {
      setLoading(false)
    }
  }, [finishTransaction, onVerified])
  processorRef.current = processPurchase

  useEffect(() => {
    if (!connected || !isStoreBillingAvailable()) return
    void fetchProducts({ skus: STORE_PRODUCT_IDS, type: "in-app" }).catch((fetchError) => {
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError))
    })
  }, [connected, fetchProducts])

  const purchase = useCallback(async (planId: string) => {
    const productId = STORE_PRODUCTS[planId]
    if (!productId || !userId) {
      setError(!productId ? "STORE_PRODUCT_NOT_MAPPED" : "STORE_ACCOUNT_REQUIRED")
      return
    }
    if (!connected) {
      setError("STORE_NOT_CONNECTED")
      return
    }
    setLoading(true)
    setPending(false)
    setError(null)
    const obfuscatedAccountId = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, userId)
    try {
      await requestPurchase({
        type: "in-app",
        request: {
          apple: { sku: productId, appAccountToken: isUuid(userId) ? userId : undefined },
          google: { skus: [productId], obfuscatedAccountId },
        },
      })
    } catch (purchaseError) {
      setLoading(false)
      if (String((purchaseError as { code?: unknown })?.code).toUpperCase().includes("CANCEL")) return
      setError(purchaseError instanceof Error ? purchaseError.message : String(purchaseError))
    }
  }, [connected, requestPurchase, userId])

  const restore = useCallback(async () => {
    if (!connected) {
      setError("STORE_NOT_CONNECTED")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const module = await import("react-native-iap")
      const purchases = await module.getAvailablePurchases({ alsoPublishToEventListenerIOS: false })
      for (const item of purchases) await processPurchase(item)
      await onVerified()
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : String(restoreError))
    } finally {
      setLoading(false)
    }
  }, [connected, onVerified, processPurchase])

  const priceForPlan = useCallback((planId: string) => {
    const productId = STORE_PRODUCTS[planId]
    const product = products.find((item: Product) => item.id === productId)
    return product?.displayPrice ?? null
  }, [products])

  const value = useMemo<StoreState>(() => ({
    available: isStoreBillingAvailable(), connected, loading, pending, error,
    name: storeName(), priceForPlan, purchase, restore, clearError: () => setError(null),
  }), [connected, error, loading, pending, priceForPlan, purchase, restore])
  return <StoreBillingContext.Provider value={value}>{children}</StoreBillingContext.Provider>
}

export function useStoreBilling() {
  const value = useContext(StoreBillingContext)
  if (!value) throw new Error("useStoreBilling must be used inside StoreBillingProvider")
  return value
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
