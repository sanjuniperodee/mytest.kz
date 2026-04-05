/**
 * Production: https://api.{site-host}/api/v1 from VITE_SITE_URL (or fallback).
 * Development: /api/v1 (Vite proxy → localhost:3000).
 * Override: VITE_API_URL.
 */
export function resolveApiBaseUrl(input: {
  readonly viteApiUrl?: string;
  readonly viteSiteUrl?: string;
  readonly viteProd: boolean;
}): string {
  const explicit = input.viteApiUrl?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const site = input.viteSiteUrl?.trim();
  if (input.viteProd && site && /^https?:\/\//i.test(site)) {
    try {
      const u = new URL(site);
      let host = u.hostname.replace(/^www\./i, '');
      if (!/^api\./i.test(host)) {
        host = `api.${host}`;
      }
      return `${u.protocol}//${host}/api/v1`;
    } catch {
      /* fall through */
    }
  }

  return '/api/v1';
}
