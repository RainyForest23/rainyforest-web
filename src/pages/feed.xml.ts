// /feed.xml을 만든다. .astro가 아닌 .ts 파일은 HTML 대신 원하는 응답을 직접 돌려준다.
import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { sortPosts } from '../lib/content/legacy'
import { buildRss } from '../lib/feed'

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('`site` is not set in astro.config.mjs')
  const posts = sortPosts(await getCollection('legacy'))
  const xml = buildRss({
    siteUrl: site.href,
    title: 'Woorim Shin — Blog',
    description: 'Study notes and write-ups.',
    // 영어 경로를 대표 주소로 쓴다.
    items: posts.map((post) => ({
      url: new URL(`/blog/${post.id}/`, site).href,
      title: post.data.title,
      date: post.data.date,
      summary: post.data.summary_en,
    })),
  })
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
