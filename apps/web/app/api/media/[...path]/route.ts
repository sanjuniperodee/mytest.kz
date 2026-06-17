import { NextRequest, NextResponse } from "next/server"

const UPSTREAM = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.my-test.kz"
const MAX_MEDIA_BYTES = 8 * 1024 * 1024
const ALLOWED_UPLOAD_RE =
  /^uploads\/(avatars|question-images|landing-images)\/[a-f0-9-]+\.(jpe?g|png|gif|webp)$/i
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
])

function mediaPath(path: string[]) {
  if (!path.length) return null
  const safePath = path.join("/")
  if (!ALLOWED_UPLOAD_RE.test(safePath)) return null
  return safePath
}

function contentLengthIsSafe(headers: Headers) {
  const raw = headers.get("content-length")
  if (!raw) return true
  const size = Number(raw)
  return Number.isFinite(size) && size >= 0 && size <= MAX_MEDIA_BYTES
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params
  const safePath = mediaPath(path)
  if (!safePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const url = new URL(UPSTREAM)
  url.pathname = `/${safePath}`
  url.search = req.nextUrl.search
  const upstream = await fetch(url)
  if (!upstream.ok) {
    return NextResponse.json({ error: "Not found" }, { status: upstream.status })
  }
  const contentType = upstream.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType) || !contentLengthIsSafe(upstream.headers)) {
    return NextResponse.json({ error: "Unsupported media" }, { status: 415 })
  }
  const headers = new Headers()
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() === "content-type" || k.toLowerCase() === "cache-control") {
      headers.set(k, v)
    }
  })
  headers.set("x-content-type-options", "nosniff")
  return new NextResponse(upstream.body, { status: 200, headers })
}

export const runtime = "nodejs"
