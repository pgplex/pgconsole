import type { MetadataRoute } from 'next'
import { getPosts } from '@/lib/blog'

const BASE_URL = 'https://www.pgconsole.com'

// Render the sitemap at build time for the static export.
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPosts()

  return [
    { url: BASE_URL, lastModified: new Date() },
    { url: `${BASE_URL}/blog`, lastModified: posts[0]?.date ?? new Date() },
    ...posts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.date,
    })),
  ]
}
