import { describe, expect, it } from 'vitest'
import { findViolations, TOKENS_FILE, VENDOR_DIR } from './check-tokens'

describe('findViolations', () => {
  it('flags hex colors outside the tokens file', () => {
    expect(findViolations('app/page.tsx', 'color: #1a1a18;')).toEqual([
      { path: 'app/page.tsx', line: 1, match: '#1a1a18' },
    ])
  })

  it('flags px values, including Tailwind arbitrary values', () => {
    const found = findViolations('components/site/card.tsx', '<div className="w-[37px] mt-4" />')
    expect(found.map((v) => v.match)).toEqual(['37px'])
  })

  it('reports the line number of each violation', () => {
    const found = findViolations('app/globals.css', 'body {\n  margin: 0;\n  padding: 12px;\n}')
    expect(found).toEqual([{ path: 'app/globals.css', line: 3, match: '12px' }])
  })

  it('allows anything in the tokens file', () => {
    expect(findViolations(TOKENS_FILE, '--color-bg: #ffffff; --space: 4px;')).toEqual([])
  })

  it('skips vendored shadcn primitives, which the CLI regenerates', () => {
    expect(findViolations(`${VENDOR_DIR}button.tsx`, 'className="px-[10px]"')).toEqual([])
  })

  it('ignores anchors that are not hex colors', () => {
    expect(findViolations('app/page.tsx', '<a href="#main">Skip</a>')).toEqual([])
  })

  it('ignores Tailwind scale classes and var() references', () => {
    expect(findViolations('app/page.tsx', 'className="px-6 py-24 text-fg-muted"')).toEqual([])
    expect(findViolations('app/globals.css', 'color: var(--color-fg);')).toEqual([])
  })
})
