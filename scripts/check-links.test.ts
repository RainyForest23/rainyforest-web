import { describe, expect, it } from 'vitest'
import { findBrokenLinks } from './check-links'

const files = new Set(['index.html', 'blog/index.html', 'blog/a/index.html', 'blog/a/fig.png', 'feed.xml'])

describe('findBrokenLinks', () => {
  it('accepts links to existing pages and assets', () => {
    const pages = new Map([['index.html', '<a href="/blog/">b</a><a href="/blog/a/">a</a><img src="/blog/a/fig.png"><a href="/feed.xml">rss</a>']])
    expect(findBrokenLinks(pages, files)).toEqual([])
  })

  it('reports a link to a page that was not generated', () => {
    const pages = new Map([['blog/index.html', '<a href="/blog/missing/">x</a>']])
    expect(findBrokenLinks(pages, files)).toEqual(['blog/index.html -> /blog/missing/'])
  })

  it('resolves extensionless paths the way the CloudFront function does', () => {
    const pages = new Map([['index.html', '<a href="/blog/a">a</a>']])
    expect(findBrokenLinks(pages, files)).toEqual([])
  })

  it('ignores external links, anchors, mailto and query strings', () => {
    const pages = new Map([['index.html', '<a href="https://x.dev">x</a><a href="#top">t</a><a href="mailto:a@b.c">m</a><a href="/blog/?q=1">q</a>']])
    expect(findBrokenLinks(pages, files)).toEqual([])
  })

  it('ignores Next.js runtime assets, which are emitted separately', () => {
    const pages = new Map([['index.html', '<script src="/_next/static/chunks/x.js"></script>']])
    expect(findBrokenLinks(pages, files)).toEqual([])
  })
})
