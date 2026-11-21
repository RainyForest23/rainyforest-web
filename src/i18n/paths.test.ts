import { describe, expect, it } from 'vitest'
import { alternates, localePath, splitLocale } from './paths'

describe('localePath', () => {
  it('leaves English paths as they are', () => {
    expect(localePath('en', '/blog/')).toBe('/blog/')
  })

  it('prefixes Korean paths with /ko', () => {
    expect(localePath('ko', '/blog/')).toBe('/ko/blog/')
    expect(localePath('ko', '/')).toBe('/ko/')
  })

  it('rejects a path that does not start and end with a slash', () => {
    expect(() => localePath('en', 'blog')).toThrow()
    expect(() => localePath('ko', '/blog')).toThrow()
  })
})

describe('splitLocale', () => {
  it('reads the Korean prefix', () => {
    expect(splitLocale('/ko/blog/x/')).toEqual({ locale: 'ko', path: '/blog/x/' })
    expect(splitLocale('/ko/')).toEqual({ locale: 'ko', path: '/' })
  })

  it('treats everything else as English', () => {
    expect(splitLocale('/blog/x/')).toEqual({ locale: 'en', path: '/blog/x/' })
    expect(splitLocale('/')).toEqual({ locale: 'en', path: '/' })
  })

  it('does not mistake a path that only starts with "ko" for Korean', () => {
    expect(splitLocale('/korea-notes/')).toEqual({ locale: 'en', path: '/korea-notes/' })
  })
})

describe('alternates', () => {
  it('lists the same page in both languages', () => {
    expect(alternates('/cv/')).toEqual([
      { locale: 'en', href: '/cv/' },
      { locale: 'ko', href: '/ko/cv/' },
    ])
  })
})
