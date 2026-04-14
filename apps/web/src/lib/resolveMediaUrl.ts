import { resolveApiBaseUrl } from './resolveApiBaseUrl';

/**
 * Пути `/uploads/...` с API — в dev через прокси того же origin; в prod — origin API без `/api/v1`.
 */
export function resolveMediaUrl(pathOrUrl: string | undefined | null): string {
  if (pathOrUrl == null || pathOrUrl === '') return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!pathOrUrl.startsWith('/uploads/')) return pathOrUrl;

  const fileBase = import.meta.env.VITE_PUBLIC_FILES_URL?.trim().replace(/\/+$/, '');
  if (fileBase) return `${fileBase}${pathOrUrl}`;

  const apiBase = resolveApiBaseUrl({
    viteApiUrl: import.meta.env.VITE_API_URL,
    viteSiteUrl:
      import.meta.env.VITE_SITE_URL || (import.meta.env.PROD ? 'https://my-test.kz' : undefined),
    viteProd: import.meta.env.PROD,
  });
  if (apiBase.startsWith('http')) {
    const origin = apiBase.replace(/\/api\/v1\/?$/i, '');
    return `${origin.replace(/\/$/, '')}${pathOrUrl}`;
  }
  return pathOrUrl;
}
