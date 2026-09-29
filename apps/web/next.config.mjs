import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = dirname(fileURLToPath(import.meta.url))
const repoRoot = dirname(dirname(appRoot))

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
      // Profiles used to live inside the community section; there is now one
      // profile page for everyone. Keeps shared links and old messages working.
      {
        source: "/dashboard/community/people/:id",
        destination: "/dashboard/profile/:id",
        permanent: true,
      },
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
