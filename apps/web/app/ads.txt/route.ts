import { fetchAdsenseClientId } from "@/lib/monetization-server"

export const revalidate = 300

/** ads.txt для Google AdSense: строится из publisher id, заданного в админке. */
export async function GET() {
  const clientId = await fetchAdsenseClientId()
  if (!clientId) {
    return new Response("# AdSense is not configured\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
  const publisherId = clientId.replace(/^ca-/, "")
  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  })
}
