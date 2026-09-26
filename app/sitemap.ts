import type { MetadataRoute } from 'next'
import { loadPosts, tagIndex } from '@/lib/content/posts'
import { loadProjects } from '@/lib/content/projects'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const posts = loadPosts()
  return [
    ...['/', '/cv/', '/projects/', '/blog/'].map((path) => ({ url: `${base}${path}` })),
    ...loadProjects().map((p) => ({ url: `${base}/projects/${p.slug}/` })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}/`, lastModified: p.updated ?? p.date })),
    ...[...tagIndex(posts).keys()].map((tag) => ({ url: `${base}/blog/tags/${tag}/` })),
  ]
}
