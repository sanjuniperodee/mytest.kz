/** Canonical site origin for SEO (no trailing slash). Set VITE_SITE_URL in production. */
export function getSiteUrl(): string {
  const raw = import.meta.env.VITE_SITE_URL || 'https://my-test.kz';
  return raw.replace(/\/+$/, '');
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function getOgImageUrl(): string {
  const custom = import.meta.env.VITE_OG_IMAGE_URL;
  if (custom && String(custom).trim()) {
    return String(custom).trim();
  }
  return `${getSiteUrl()}/og-cover.svg`;
}

/** Primary og:locale for the active UI language (SPA). */
export function getOgLocaleForI18n(lng: string): 'ru_RU' | 'kk_KZ' | 'en_US' {
  if (lng === 'kk') return 'kk_KZ';
  if (lng === 'en') return 'en_US';
  return 'ru_RU';
}
