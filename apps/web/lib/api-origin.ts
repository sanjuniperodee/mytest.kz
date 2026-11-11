/**
 * Where Next's server code calls the Nest API.
 *
 * API_INTERNAL_URL (server-only, e.g. http://127.0.0.1:3001) lets the proxy reach Nest on the same
 * machine without leaving through the public address. Through api.my-test.kz the request comes back in
 * from the server's own public IP, nginx appends that IP to X-Forwarded-For, and the API's rate limits
 * then see one address for every visitor. Not set → the public origin, exactly as before.
 *
 * Read per call, not at import: it is a runtime variable (not NEXT_PUBLIC_*, so not baked into the build).
 */
export const API_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.my-test.kz"

export function apiInternalOrigin(): string {
  const internal = process.env.API_INTERNAL_URL?.trim()
  return (internal || API_PUBLIC_ORIGIN).replace(/\/+$/, "")
}
