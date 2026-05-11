// Helpers for handling localized values from the backend.
//
// Some endpoints return strings, others return localized objects in the form
// `{ ru: "...", kk: "...", en: "..." }`. Rendering such an object directly as a
// React child throws "Minified React error #31". Use `localize()` everywhere we
// display backend-provided text so the app stays robust regardless of shape.

export type Locale = "ru" | "kk" | "en"

export type LocalizedText =
  | string
  | number
  | null
  | undefined
  | {
      ru?: string | null
      kk?: string | null
      en?: string | null
      [key: string]: unknown
    }

const FALLBACK_ORDER: Locale[] = ["ru", "kk", "en"]

/**
 * Extract a string from a value that may be a localized object.
 * - Strings/numbers are returned as-is
 * - Objects are scanned for the requested locale, then fallback locales,
 *   then any other string-valued key
 * - Any non-string fallback returns ""
 */
export function localize(
  value: LocalizedText,
  preferred: Locale = "ru",
  fallback: string = "",
): string {
  if (value == null) return fallback
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value !== "object") return fallback

  const obj = value as Record<string, unknown>

  const tryKey = (k: string): string | null => {
    const v = obj[k]
    if (typeof v === "string" && v.trim().length > 0) return v
    if (typeof v === "number") return String(v)
    return null
  }

  const direct = tryKey(preferred)
  if (direct) return direct

  for (const loc of FALLBACK_ORDER) {
    if (loc === preferred) continue
    const v = tryKey(loc)
    if (v) return v
  }

  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "string" && (obj[k] as string).trim().length > 0) {
      return obj[k] as string
    }
  }

  return fallback
}

/**
 * Recursively normalize an entire payload, replacing localized objects with
 * strings in the requested locale. Useful when feeding form data, etc.
 */
export function localizeDeep<T = unknown>(value: unknown, locale: Locale = "ru"): T {
  if (value == null) return value as T
  if (typeof value !== "object") return value as T

  if (Array.isArray(value)) {
    return value.map((v) => localizeDeep(v, locale)) as unknown as T
  }

  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
  const localizedKeys = ["ru", "kk", "en"]
  const looksLocalized =
    keys.length > 0 &&
    keys.every((k) => localizedKeys.includes(k)) &&
    keys.some((k) => typeof obj[k] === "string")

  if (looksLocalized) {
    return localize(value as LocalizedText, locale) as unknown as T
  }

  const out: Record<string, unknown> = {}
  for (const k of keys) {
    out[k] = localizeDeep(obj[k], locale)
  }
  return out as T
}
