import type { Post } from './content/model'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c])

export function buildRss(input: { siteUrl: string; title: string; description: string; posts: Post[] }): string {
  const items = input.posts
    .map((p) => {
      const url = `${input.siteUrl}/blog/${p.slug}/`
      return [
        '    <item>',
        `      <title>${escapeXml(p.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(p.summaryEn)}</description>`,
        '    </item>',
      ].join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(input.title)}</title>`,
    `    <link>${input.siteUrl}/blog/</link>`,
    `    <description>${escapeXml(input.description)}</description>`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
