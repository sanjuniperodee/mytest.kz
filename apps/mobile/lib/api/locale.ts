export type RequestLocale = "ru" | "kk"

let requestLocale: RequestLocale = "ru"

/** Language the API should localize responses in; sent as Accept-Language. */
export function setRequestLocale(locale: RequestLocale) {
  requestLocale = locale
}

export function getRequestLocale(): RequestLocale {
  return requestLocale
}
