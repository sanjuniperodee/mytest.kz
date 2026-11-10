import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = dirname(fileURLToPath(import.meta.url))
const repoRoot = dirname(dirname(appRoot))

// Topic tests /ent/<subject>/<topic> that no longer exist (the question bank has no such
// topic any more). The list is written by scripts/build-practice-seo-data.mjs.
const retiredPracticeTopics = JSON.parse(readFileSync(join(appRoot, "lib/seo/practice-redirects.json"), "utf8"))

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: repoRoot,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      // www.my-test.kz used to answer 200 with a full copy of the site. One host
      // only: the apex (canonical URLs already point there).
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.my-test.kz" }],
        destination: "https://my-test.kz/:path*",
        permanent: true,
      },
      // Profiles used to live inside the community section; there is now one
      // profile page for everyone. Keeps shared links and old messages working.
      {
        source: "/dashboard/community/people/:id",
        destination: "/dashboard/profile/:id",
        permanent: true,
      },
      // There is no /ent-2026 page; send that still-searched URL
      // (and any backlinks) to the current ENT landing instead of a 404.
      {
        source: "/ent-2026",
        destination: "/ent-2027",
        permanent: true,
      },
      // Indexed topic pages that are gone → the subject page, not a 404.
      ...retiredPracticeTopics.map(({ source, destination }) => ({ source, destination, permanent: true })),
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mytest.kz",
      },
      {
        protocol: "https",
        hostname: "**.mytest.kz",
      },
      {
        protocol: "https",
        hostname: "bilimland.kz",
      },
      {
        protocol: "https",
        hostname: "**.bilimland.kz",
      },
    ],
  },
}

export default nextConfig
