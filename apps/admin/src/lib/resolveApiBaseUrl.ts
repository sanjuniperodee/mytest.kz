/**
 * Production: absolute API origin (VITE_API_URL or derived from VITE_SITE_URL).
 * admin.example.com → api.example.com (not api.admin.example.com).
 * Development: /api/v1 (Vite proxy → localhost:3000).
 */
function siteHostnameToApiHostname(hostname: string): string {
  let h = hostname.replace(/^www\./i, '');
  if (/^admin\./i.test(h)) {
    return `api.${h.slice('admin.'.length)}`;
  }
  if (/^api\./i.test(h)) {
    return h;
  }
  return `api.${h}`;
}

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
      const host = siteHostnameToApiHostname(u.hostname);
      return `${u.protocol}//${host}/api/v1`;
    } catch {
      /* fall through */
    }
  }

  return '/api/v1';
}
