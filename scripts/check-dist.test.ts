import { describe, expect, it } from 'vitest'
import { brokenRedirects, forbiddenText, missingAlternates, missingPages } from './check-dist'

describe('missingPages', () => {
  it('finds a missing page', () => {
    expect(missingPages(new Set(['index.html']), ['/', '/ko/'])).toEqual(['/ko/'])
  })

  it('accepts files that are not pages', () => {
    expect(missingPages(new Set(['feed.xml', '404.html']), ['/feed.xml', '/404.html'])).toEqual([])
  })
})

describe('brokenRedirects', () => {
  it('decodes redirect targets', () => {
    expect(
      brokenRedirects({ '/forest/%EA%B0%80/': '/blog/ta-administration/' }, new Set(['blog/ta-administration/index.html'])),
    ).toEqual([])
    expect(brokenRedirects({ '/x/': '/blog/%ED%95%9C/' }, new Set(['blog/한/index.html']))).toEqual([])
  })

  it('reports a target that was not built', () => {
    expect(brokenRedirects({ '/x/': '/blog/gone/' }, new Set())).toEqual(['/x/ -> /blog/gone/'])
  })
})

describe('forbiddenText', () => {
  it('flags a GPA anywhere', () => {
    expect(forbiddenText(new Map([['cv/index.html', '<p>GPA [removed]</p>']]), [/GPA/i, /0\.00/])).toEqual([
      'cv/index.html: /GPA/i',
      'cv/index.html: /0\\.00/',
    ])
  })

  it('passes clean pages', () => {
    expect(forbiddenText(new Map([['cv/index.html', '<p>Ewha Womans University</p>']]), [/GPA/i])).toEqual([])
  })
})

describe('missingAlternates', () => {
  const link = (lang: string, href: string) => `<link rel="alternate" hreflang="${lang}" href="${href}">`

  it('requires both hreflang links', () => {
    const page = link('en', '/cv/')
    expect(missingAlternates(new Map([['cv/index.html', page]]))).toEqual(['cv/index.html: ko'])
  })

  it('accepts absolute links to pages that exist', () => {
    const page = link('en', 'https://example.dev/cv/') + link('ko', 'https://example.dev/ko/cv/')
    const pages = new Map([
      ['cv/index.html', page],
      ['ko/cv/index.html', page],
    ])
    expect(missingAlternates(pages)).toEqual([])
  })

  it('reports a link to a page that was not built', () => {
    const page = link('en', '/cv/') + link('ko', '/ko/cv/')
    expect(missingAlternates(new Map([['cv/index.html', page]]))).toEqual(['cv/index.html: ko -> /ko/cv/ is not built'])
  })

  it('skips the 404 page and redirect pages', () => {
    const pages = new Map([
      ['404.html', '<title>Page not found</title>'],
      ['old/index.html', '<meta http-equiv="refresh" content="0;url=/blog/">'],
    ])
    expect(missingAlternates(pages)).toEqual([])
  })
})
