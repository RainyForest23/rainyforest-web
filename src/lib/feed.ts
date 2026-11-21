// RSS 2.0 문서를 문자열로 만든다. src/pages/feed.xml.ts가 쓴다.

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
const escapeXml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char]!)

export interface FeedItem {
  /** 글의 전체 주소 */
  url: string
  title: string
  /** 'YYYY-MM-DD' */
  date: string
  summary: string
}

export function buildRss(input: { siteUrl: string; title: string; description: string; items: FeedItem[] }): string {
  const siteUrl = input.siteUrl.replace(/\/$/, '')
  const items = input.items.map((item) =>
    [
      '    <item>',
      `      <title>${escapeXml(item.title)}</title>`,
      `      <link>${escapeXml(item.url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(item.url)}</guid>`,
      `      <pubDate>${new Date(`${item.date}T00:00:00Z`).toUTCString()}</pubDate>`,
      `      <description>${escapeXml(item.summary)}</description>`,
      '    </item>',
    ].join('\n'),
  )

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(input.title)}</title>`,
    `    <link>${siteUrl}/blog/</link>`,
    `    <description>${escapeXml(input.description)}</description>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
