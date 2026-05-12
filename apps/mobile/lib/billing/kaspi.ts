export interface KaspiOrder {
  invoiceId: string
  providerOrderId: string
  status: string
  amount: number
  currency: string
  planCode: string
  planName: string
  paymentType?: "invoice" | "qr" | string
  checkoutUrl: string | null
  receiptUrl: string | null
  qrToken?: string | null
  expiresAt?: string | null
  fallbackToQr?: boolean
  statusDesc?: string | null
  orderNumber?: string | null
  createdAt: string
  paidAt?: string | null
}

export interface KaspiCheckoutResponse {
  invoiceId?: string | number | null
  providerOrderId?: string | number | null
  orderId?: string | number | null
  receiptUrl?: string | null
  checkoutUrl?: string | null
  data?: KaspiCheckoutResponse
  Data?: {
    Id?: string | number | null
    ReceiptUrl?: string | null
  }
}

export type PaymentStatusKind = "pending" | "paid" | "inactive"

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null

  const direct = Date.parse(raw)
  if (!Number.isNaN(direct)) return direct

  // Fallback for timestamps without timezone suffix.
  const withUtc = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}Z`
  const asUtc = Date.parse(withUtc)
  if (!Number.isNaN(asUtc)) return asUtc

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function getString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim()
    const lower = normalized.toLowerCase()
    if (lower === "undefined" || lower === "null" || lower === "unknown") return null
    return normalized
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

export function normalizeKaspiCheckoutResponse(value: unknown): {
  invoiceId: string | null
  receiptUrl: string | null
} {
  if (!isRecord(value)) return { invoiceId: null, receiptUrl: null }

  const nested = isRecord(value.data) ? value.data : isRecord(value.Data) ? value.Data : null
  const invoiceId =
    getString(value.invoiceId) ||
    getString(value.providerOrderId) ||
    getString(value.orderId) ||
    getString(nested?.invoiceId) ||
    getString(nested?.providerOrderId) ||
    getString(nested?.orderId) ||
    getString(nested?.Id)
  const receiptUrl =
    getString(value.receiptUrl) ||
    getString(value.checkoutUrl) ||
    getString(nested?.receiptUrl) ||
    getString(nested?.checkoutUrl) ||
    getString(nested?.ReceiptUrl)

  return { invoiceId, receiptUrl }
}

export function resolveOrderInvoiceId(order: KaspiOrder): string | null {
  return getString(order.invoiceId) || getString(order.providerOrderId)
}

export function paymentStatusKind(status: unknown): PaymentStatusKind {
  const normalized = String(status || "").trim().toLowerCase()
  if (normalized === "paid" || normalized === "processed" || normalized === "success" || normalized === "succeeded") {
    return "paid"
  }
  if (
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "expired" ||
    normalized === "sessionexpired" ||
    normalized === "remotepaymentcanceled" ||
    normalized === "remotepaymentrejected"
  ) {
    return "inactive"
  }
  return "pending"
}

export function formatKaspiDateTime(value: string | null | undefined, locale: "ru-RU" | "kk-KZ" = "ru-RU") {
  const timestamp = parseTimestamp(value)
  if (timestamp == null) return ""
  return new Date(timestamp).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatTimeLeft(target: string | null | undefined, nowMs: number) {
  const targetMs = parseTimestamp(target)
  if (targetMs == null) return null
  const diffMs = targetMs - nowMs
  if (!Number.isFinite(diffMs)) return null
  if (diffMs <= 0) return "Истек"
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}
