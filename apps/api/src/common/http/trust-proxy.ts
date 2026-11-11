/**
 * Express `trust proxy` for the API. `req.ip` — and therefore every @Throttle bucket, because the
 * ThrottlerGuard keys on `req.ip` — is derived from it, so it decides who may choose the client address.
 *
 * Express walks X-Forwarded-For from the right and stops at the first address it does not trust;
 * that address is `req.ip`. Everything to its left was written by someone we do not trust and is ignored.
 * Hence the list must hold only hops that really are ours and that overwrite or append the header:
 *
 *   browser → nginx (appends $remote_addr) → Nest                       api.my-test.kz (mobile, Telegram)
 *   browser → nginx → Next (sends ONE address) → Nest on loopback       my-test.kz, API_INTERNAL_URL set
 *
 * Default `loopback` (nginx and Next both reach Nest from 127.0.0.1). Do not widen it to "everything"
 * (`true`, a huge CIDR): then a client-sent X-Forwarded-For picks its own throttle bucket.
 *
 * TRUST_PROXY: comma-separated addresses / CIDRs / Express keywords (`loopback,10.0.0.0/8`), or a plain
 * number — that many hops from the socket. An invalid value makes Express throw at startup, which is
 * what we want: better a failed boot than silently trusting the wrong thing.
 */
export function resolveTrustProxy(raw: string | undefined = process.env.TRUST_PROXY): string | number {
  const value = raw?.trim();
  if (!value) return 'loopback';
  return /^\d+$/.test(value) ? Number(value) : value;
}

/** The part of the Express app this module needs; `NestExpressApplication` satisfies it. */
export interface TrustProxyTarget {
  set(setting: string, value: unknown): unknown;
}

export function configureTrustProxy(
  app: TrustProxyTarget,
  raw: string | undefined = process.env.TRUST_PROXY,
): void {
  app.set('trust proxy', resolveTrustProxy(raw));
}
