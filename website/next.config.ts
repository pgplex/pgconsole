import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Emit a fully static site to ./out for Cloudflare Pages.
  output: 'export',
  // Cloudflare Pages serves the static export directly; skip the Image
  // Optimization API, which requires a server runtime.
  images: { unoptimized: true },
  // Serve each route as a directory with index.html (clean URLs on Pages).
  trailingSlash: true,
}

export default nextConfig
