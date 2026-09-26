import { describe, expect, it } from 'vitest'
import type { Post } from './model'
import { findMissingAssets, validatePosts } from './validate'

function post(overrides: Partial<Post>): Post {
  return {
    slug: 'a',
    title: 'Title',
    summaryEn: 'Summary.',
    lang: 'ko',
    date: '2026-05-06',
    tags: ['aws'],
    source: 'legacy',
    body: '',
    outgoing: [],
    ...overrides,
  }
}

describe('validatePosts', () => {
  it('accepts a well-formed set', () => {
    expect(validatePosts([post({ slug: 'a' }), post({ slug: 'b' })])).toEqual([])
  })

  it('rejects duplicate slugs', () => {
    expect(validatePosts([post({}), post({})]).join(' ')).toContain('duplicate slug')
  })

  it('rejects a missing English summary', () => {
    expect(validatePosts([post({ summaryEn: '' })]).join(' ')).toContain('summary_en')
  })

  it('rejects slugs and tags that are not lowercase ASCII kebab-case', () => {
    expect(validatePosts([post({ slug: 'TAadministration' })]).join(' ')).toContain('slug')
    expect(validatePosts([post({ tags: ['코드트리'] })]).join(' ')).toContain('tag')
    expect(validatePosts([post({ tags: ['AI Workload'] })]).join(' ')).toContain('tag')
  })

  it('rejects dates that are not YYYY-MM-DD', () => {
    expect(validatePosts([post({ date: 'May 6, 2026' })]).join(' ')).toContain('date')
  })

  it('rejects an unknown language', () => {
    expect(validatePosts([post({ lang: 'jp' as Post['lang'] })]).join(' ')).toContain('lang')
  })
})

describe('findMissingAssets', () => {
  const body = 'Text\n\n![Figure 1](/blog/energy-attribution-model/fig1.png)\n\n![Figure 2](/blog/energy-attribution-model/fig2.png)'

  it('reports images the body references but public/ does not have', () => {
    const exists = (p: string) => p === '/blog/energy-attribution-model/fig1.png'
    expect(findMissingAssets([post({ slug: 'energy-attribution-model', body })], exists)).toEqual([
      'blog/energy-attribution-model: missing image /blog/energy-attribution-model/fig2.png',
    ])
  })

  it('ignores external images', () => {
    const external = post({ body: '![x](https://example.com/x.png)' })
    expect(findMissingAssets([external], () => false)).toEqual([])
  })
})
