import { describe, expect, it } from 'vitest'
import { formatPeriod } from './format'

describe('formatPeriod', () => {
  it('formats a closed range', () => {
    expect(formatPeriod({ start: '2025-06', end: '2026-02' })).toBe('Jun 2025 – Feb 2026')
  })

  it('marks an open range as ongoing', () => {
    expect(formatPeriod({ start: '2026-02' })).toBe('Feb 2026 – Present')
  })

  it('accepts year-only dates', () => {
    expect(formatPeriod({ start: '2025', end: '2026' })).toBe('2025 – 2026')
  })

  it('collapses a range that starts and ends in the same month', () => {
    expect(formatPeriod({ start: '2026-05', end: '2026-05' })).toBe('May 2026')
  })

  it('accepts full ISO dates as they appear in resume.json', () => {
    expect(formatPeriod({ start: '2023-03-01', end: '2027' })).toBe('Mar 2023 – 2027')
  })

  it('treats "Present" as an open range', () => {
    expect(formatPeriod({ start: '2025-06-01', end: 'Present' })).toBe('Jun 2025 – Present')
  })
})
