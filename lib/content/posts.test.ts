import { describe, expect, it } from 'vitest'
import type { Post } from './model'
import { formatDate, loadPosts, sortPosts, tagIndex } from './posts'

function post(slug: string, date: string, tags: string[]): Post {
  return { slug, title: slug, summaryEn: 's', lang: 'ko', date, tags, source: 'legacy', body: '', outgoing: [] }
}

describe('sortPosts', () => {
  it('orders posts newest first', () => {
    const sorted = sortPosts([post('old', '2024-09-04', []), post('new', '2026-06-22', [])])
    expect(sorted.map((p) => p.slug)).toEqual(['new', 'old'])
  })
})

describe('tagIndex', () => {
  it('groups posts by tag, tags alphabetical, posts newest first', () => {
    const index = tagIndex([
      post('a', '2026-01-01', ['aws', 'cloud']),
      post('b', '2026-02-01', ['aws']),
    ])
    expect([...index.keys()]).toEqual(['aws', 'cloud'])
    expect(index.get('aws')?.map((p) => p.slug)).toEqual(['b', 'a'])
  })
})

describe('formatDate', () => {
  it('formats an ISO date in English without timezone drift', () => {
    expect(formatDate('2026-05-06')).toBe('May 6, 2026')
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026')
  })
})

describe('loadPosts', () => {
  it('loads every migrated post and passes validation', () => {
    const posts = loadPosts()
    expect(posts.length).toBe(18)
    expect(posts[0].date >= posts[posts.length - 1].date).toBe(true)
  })
})
