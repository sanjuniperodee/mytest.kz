import { NextRequest, NextResponse } from "next/server"
// Relative on purpose: apps/api/test/web-proxy-client-ip.http.spec.ts runs this handler against a real Nest
// app, and the API's Jest does not know the web app's "@/" alias.
import { apiInternalOrigin } from "../../../../lib/api-origin"
import { clientIpFromNginx, setForwardedClientIp } from "../../../../lib/client-ip"

// Headers that fetch will set automatically; do not forward
const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "accept-encoding",
])

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const search = req.nextUrl.search
  const url = `${apiInternalOrigin()}/api/v1/${path.join("/")}${search}`

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value)
  })
  // The API counts rate limits per client address, so it must get the visitor's address from us, not from
  // headers the browser wrote: one X-Forwarded-For, taken from what our nginx put in (lib/client-ip.ts).
  setForwardedClientIp(headers, clientIpFromNginx(req.headers))

  // duplex is required for streaming bodies on Node fetch but missing from some RequestInit typings.
  const init: RequestInit & { duplex: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
    duplex: "half",
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = req.body || undefined;
  }

  let upstream: Response
  try {
    upstream = await fetch(url, init)
  } catch (err) {
    console.error("API proxy upstream unavailable", err)
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 502 },
    )
  }

  const resHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) resHeaders.set(key, value)
  })

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  })
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const PUT = proxy
export const DELETE = proxy
export const OPTIONS = proxy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
