import { NextRequest, NextResponse } from "next/server"

const UPSTREAM = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.my-test.kz"

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params
  const url = `${UPSTREAM}/${path.join("/")}${req.nextUrl.search}`
  const upstream = await fetch(url)
  if (!upstream.ok) {
    return NextResponse.json({ error: "Not found" }, { status: upstream.status })
  }
  const headers = new Headers()
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() === "content-type" || k.toLowerCase() === "cache-control") {
      headers.set(k, v)
    }
  })
  return new NextResponse(upstream.body, { status: 200, headers })
}

export const runtime = "nodejs"
