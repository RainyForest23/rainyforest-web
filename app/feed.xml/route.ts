import { buildRss } from '@/lib/feed'
import { loadPosts } from '@/lib/content/posts'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export function GET() {
  const xml = buildRss({
    siteUrl: siteUrl(),
    title: 'Woorim Shin — Blog',
    description: 'Notes on cloud infrastructure, AI systems and problem solving.',
    posts: loadPosts(),
  })
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
