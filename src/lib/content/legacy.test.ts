import { describe, expect, it } from 'vitest'
import { legacySchema, sortPosts, tagIndex, translationOf } from './legacy'

const base = { title: 't', summary_en: 's', lang: 'ko', date: '2026-04-14', tags: [] }

describe('legacySchema', () => {
  it('keeps an unquoted YAML date on the same day', () => {
    // YAML은 따옴표 없는 날짜를 UTC 자정의 Date로 읽는다.
    const parsed = legacySchema.parse({ ...base, date: new Date('2026-04-14T00:00:00Z') })
    expect(parsed.date).toBe('2026-04-14')
  })

  it('keeps a quoted date as it is', () => {
    expect(legacySchema.parse({ ...base, updated: '2026-05-01' }).updated).toBe('2026-05-01')
  })

  it('rejects a date that is not YYYY-MM-DD', () => {
    expect(legacySchema.safeParse({ ...base, date: '2026-4-14' }).success).toBe(false)
  })

  it('rejects a non-kebab tag', () => {
    expect(legacySchema.safeParse({ ...base, tags: ['AWS'] }).success).toBe(false)
  })

  it('requires summary_en', () => {
    expect(legacySchema.safeParse({ title: 't', lang: 'ko', date: '2026-04-14' }).success).toBe(false)
  })

  it('rejects a language other than ko or en', () => {
    expect(legacySchema.safeParse({ ...base, lang: 'jp' }).success).toBe(false)
  })

  it('treats missing tags as an empty list', () => {
    expect(legacySchema.parse({ title: 't', summary_en: 's', lang: 'en', date: '2026-04-14' }).tags).toEqual([])
  })
})

const post = (id: string, date: string, tags: string[] = []) => ({ id, data: { date, tags } })

describe('sortPosts', () => {
  it('sorts newest first, then by id', () => {
    const sorted = sortPosts([post('b', '2026-01-01'), post('a', '2026-01-01'), post('c', '2026-02-01')])
    expect(sorted.map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })

  it('does not change the list it was given', () => {
    const posts = [post('a', '2026-01-01'), post('b', '2026-02-01')]
    sortPosts(posts)
    expect(posts.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('tagIndex', () => {
  it('groups posts by tag, tags in alphabetical order, posts newest first', () => {
    const index = tagIndex([
      post('old', '2026-01-01', ['cloud', 'aws']),
      post('new', '2026-03-01', ['aws']),
    ])
    expect([...index.keys()]).toEqual(['aws', 'cloud'])
    expect(index.get('aws')!.map((x) => x.id)).toEqual(['new', 'old'])
    expect(index.get('cloud')!.map((x) => x.id)).toEqual(['old'])
  })
})

describe('translationOf', () => {
  const ids = ['energy-model', 'energy-model-ko', 'saa-iam']

  it('pairs a post with its -ko twin, both ways', () => {
    expect(translationOf('energy-model', ids)).toBe('energy-model-ko')
    expect(translationOf('energy-model-ko', ids)).toBe('energy-model')
  })

  it('returns undefined when there is no twin', () => {
    expect(translationOf('saa-iam', ids)).toBeUndefined()
    expect(translationOf('other-ko', ['other-ko'])).toBeUndefined()
  })
})
