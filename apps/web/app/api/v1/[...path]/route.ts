import { NextRequest, NextResponse } from "next/server"

const UPSTREAM = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.my-test.kz"

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
  const url = `${UPSTREAM}/api/v1/${path.join("/")}${search}`

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value)
  })

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
    // @ts-expect-error - duplex required for streaming bodies on Node fetch
    duplex: "half",
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = await req.arrayBuffer()
  }

  let upstream: Response
  try {
    upstream = await fetch(url, init)
  } catch (err) {
    return NextResponse.json(
      { error: "Upstream unavailable", message: String(err) },
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
