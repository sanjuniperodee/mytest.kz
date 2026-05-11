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
