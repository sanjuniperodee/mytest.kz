import { isIP } from "node:net"

/**
 * Real address of the visitor, for the API's rate limits. Server-only (route handlers, server components).
 *
 * The request reaches Next from our own nginx, which writes the visitor's address (`$remote_addr`) into
 * X-Forwarded-For (appended after whatever the browser sent) and/or X-Real-IP (overwritten). The browser
 * can write both headers too, so only what nginx wrote counts:
 *   - X-Forwarded-For: the LAST entry. Everything to its left came from the browser.
 *   - X-Real-IP: the value as is (nginx replaces a browser-sent one).
 * If both are present they must agree; if they do not, or either is not an IP address, one of them was
 * not written by nginx and we trust neither (null → the API counts the request under the server's own
 * address, the same shared bucket as before, never a bucket the visitor chose).
 *
 * Exception: when nginx sends no X-Forwarded-For, Next fills it in with the socket address — nginx itself,
 * i.e. loopback. A loopback "visitor" is that fill-in (or a local caller), not a visitor: treated as absent.
 */

type HeaderReader = { get(name: string): string | null }

function isLoopback(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, "")
  return v === "::1" || v.startsWith("127.")
}

export function clientIpFromNginx(headers: HeaderReader): string | null {
  const forwardedLast = headers.get("x-forwarded-for")?.split(",").pop()?.trim() || null
  const realIp = headers.get("x-real-ip")?.trim() || null
  const fromForwarded = forwardedLast && isIP(forwardedLast) ? forwardedLast.toLowerCase() : null
  const fromReal = realIp && isIP(realIp) ? realIp.toLowerCase() : null

  if ((forwardedLast && !fromForwarded) || (realIp && !fromReal)) return null
  if (fromForwarded && isLoopback(fromForwarded)) return fromReal
  if (fromForwarded && fromReal && fromForwarded !== fromReal) return null
  return fromForwarded ?? fromReal
}

/**
 * Headers the API reads (or could read) the client address from. Whatever the browser sent in them is
 * dropped before the request goes to the API; a single X-Forwarded-For written by us replaces it.
 */
const CLIENT_ADDRESS_HEADERS = ["x-forwarded-for", "x-real-ip", "forwarded"]

export function setForwardedClientIp(headers: Headers, clientIp: string | null): void {
  for (const name of CLIENT_ADDRESS_HEADERS) headers.delete(name)
  if (clientIp) headers.set("x-forwarded-for", clientIp)
}
