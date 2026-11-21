import { describe, expect, it } from 'vitest'
import { findViolations, shouldCheck, TOKENS_FILE } from './check-tokens'

describe('findViolations', () => {
  it('flags hex colors outside the tokens file', () => {
    expect(findViolations('src/views/Home.astro', 'color: #1a1a18;')).toEqual([
      { path: 'src/views/Home.astro', line: 1, match: '#1a1a18' },
    ])
  })

  it('flags px values, including Tailwind arbitrary values', () => {
    const found = findViolations('src/views/Card.astro', '<div className="w-[37px] mt-4" />')
    expect(found.map((v) => v.match)).toEqual(['37px'])
  })

  it('reports the line number of each violation', () => {
    const found = findViolations('src/styles/prose.css', 'body {\n  margin: 0;\n  padding: 12px;\n}')
    expect(found).toEqual([{ path: 'src/styles/prose.css', line: 3, match: '12px' }])
  })

  it('allows anything in the tokens file', () => {
    expect(findViolations(TOKENS_FILE, '--color-bg: #ffffff; --space: 4px;')).toEqual([])
  })

  it('checks .astro files', () => {
    expect(findViolations('src/views/Home.astro', '<style>.a{color:#fff}</style>')).toHaveLength(1)
  })

  it('allows values in the tokens file', () => {
    expect(findViolations('src/styles/tokens.css', ':root{--x:#fff;--y:4px}')).toEqual([])
  })

  it('ignores anchors that are not hex colors', () => {
    expect(findViolations('src/views/Home.astro', '<a href="#main">Skip</a>')).toEqual([])
  })

  it('ignores Tailwind scale classes and var() references', () => {
    expect(findViolations('src/views/Home.astro', 'className="px-6 py-24 text-fg-muted"')).toEqual([])
    expect(findViolations('src/styles/prose.css', 'color: var(--color-fg);')).toEqual([])
  })
})

describe('shouldCheck', () => {
  it('includes .astro, .css, .ts and .mdx files', () => {
    expect(['a.astro', 'a.css', 'a.ts', 'a.tsx', 'a.mdx'].map(shouldCheck)).toEqual([true, true, true, true, true])
  })

  it('skips test files and other file types', () => {
    expect(['a.test.ts', 'a.json', 'a.png'].map(shouldCheck)).toEqual([false, false, false])
  })
})
