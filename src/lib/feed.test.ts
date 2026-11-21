import { describe, expect, it } from 'vitest'
import { buildRss } from './feed'

const xml = buildRss({
  siteUrl: 'https://example.dev',
  title: 'Blog',
  description: 'Notes',
  items: [
    {
      url: 'https://example.dev/blog/saa-s3-practice/',
      title: 'S3 & Glacier: <Lifecycle> "rules"',
      date: '2026-05-06',
      summary: 'Storage classes & lifecycle rules, with prices < $0.01/GB.',
    },
  ],
})

describe('buildRss', () => {
  it('escapes XML special characters in titles and summaries', () => {
    expect(xml).toContain('<title>S3 &amp; Glacier: &lt;Lifecycle&gt; &quot;rules&quot;</title>')
    expect(xml).toContain('prices &lt; $0.01/GB')
    expect(xml).not.toMatch(/<title>[^<]*<Lifecycle>/)
  })

  it('uses the item URL for link and guid', () => {
    expect(xml).toContain('<link>https://example.dev/blog/saa-s3-practice/</link>')
    expect(xml).toContain('<guid isPermaLink="true">https://example.dev/blog/saa-s3-practice/</guid>')
  })

  it('writes RFC 822 dates', () => {
    expect(xml).toContain('<pubDate>Wed, 06 May 2026 00:00:00 GMT</pubDate>')
  })

  it('is a single RSS 2.0 channel that links to the blog', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml.match(/<channel>/g)).toHaveLength(1)
    expect(xml).toContain('<link>https://example.dev/blog/</link>')
  })

  it('accepts a site URL with a trailing slash', () => {
    const out = buildRss({ siteUrl: 'https://example.dev/', title: 'B', description: 'N', items: [] })
    expect(out).toContain('<link>https://example.dev/blog/</link>')
  })
})
