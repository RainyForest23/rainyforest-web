import { describe, expect, it } from 'vitest'
import { brokenRedirects, FORBIDDEN, forbiddenText, missingAlternates, missingPages, orphanFiles, scannable } from './check-dist'

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
  it('reports the file and the pattern', () => {
    expect(forbiddenText(new Map([['cv/index.html', '<p>secret</p>']]), [/secret/, /absent/])).toEqual([
      'cv/index.html: /secret/',
    ])
  })

  it('passes clean pages', () => {
    expect(forbiddenText(new Map([['cv/index.html', '<p>Ewha Womans University</p>']]), [/secret/])).toEqual([])
  })
})

// 테스트에는 지어낸 값만 쓴다. 실제 학점을 이 레포 어디에도 적지 않는다.
describe('FORBIDDEN', () => {
  const hit = (text: string) => FORBIDDEN.some((pattern) => pattern.test(text))

  it('catches a grade in English or Korean, whatever the number', () => {
    expect(hit('<p>GPA: 1.23/4.5</p>')).toBe(true)
    expect(hit('<p>gpa 1.23 / 4.3</p>')).toBe(true)
    expect(hit('<p>1.2/4.5</p>')).toBe(true)
    expect(hit('<p>학점 1.23</p>')).toBe(true)
  })

  it('does not fire on ordinary text', () => {
    expect(hit('<p>Ewha Womans University, 2023 – 2027</p>')).toBe(false)
    expect(hit('<p>version 4.5 of the tool</p>')).toBe(false)
  })
})

describe('scannable', () => {
  it('drops build noise that could match by accident', () => {
    const html = '<style>.gpa{}</style><p data-astro-cid-gpa12abc class="x">hi</p><script src="/_astro/GPA.x1.js"></script>'
    expect(scannable(html)).not.toMatch(/gpa/i)
    expect(scannable(html)).toContain('hi')
  })

  it('keeps attribute text such as descriptions', () => {
    expect(scannable('<meta name="description" content="GPA 1.23/4.5">')).toContain('GPA 1.23/4.5')
  })
})

describe('orphanFiles', () => {
  const pages = new Map([['index.html', '<a href="/cv/talk.pdf">t</a><img src="/blog/%ED%95%9C/fig.png">']])

  it('reports a file that no page links to', () => {
    const files = new Set(['index.html', 'cv/talk.pdf', 'blog/한/fig.png', 'projects/internal-report.pdf'])
    expect(orphanFiles(pages, files, [])).toEqual(['projects/internal-report.pdf'])
  })

  it('accepts files on the allow list and build assets', () => {
    const files = new Set(['index.html', 'cv/talk.pdf', 'blog/한/fig.png', 'sitemap-0.xml', '_astro/a.css', '_headers'])
    expect(orphanFiles(pages, files, ['sitemap-0.xml', '_headers'])).toEqual([])
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
