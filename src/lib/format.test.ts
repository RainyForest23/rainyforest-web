import { describe, expect, it } from 'vitest'
import { formatDate, formatPeriod } from './format'

describe('formatDate', () => {
  it('en', () => expect(formatDate('2026-05-06', 'en')).toBe('May 6, 2026'))
  it('ko', () => expect(formatDate('2026-05-06', 'ko')).toBe('2026년 5월 6일'))
})

describe('formatPeriod', () => {
  it('month range', () =>
    expect(formatPeriod({ start: '2025-06', end: '2026-02' }, 'en')).toBe('Jun 2025 – Feb 2026'))
  it('month range ko', () =>
    expect(formatPeriod({ start: '2025-06', end: '2026-02' }, 'ko')).toBe('2025년 6월 – 2026년 2월'))
  it('year range', () => expect(formatPeriod({ start: '2023', end: '2025' }, 'en')).toBe('2023 – 2025'))
  it('ongoing', () => expect(formatPeriod({ start: '2026-06' }, 'en')).toBe('Jun 2026 – Present'))
  it('ongoing ko', () => expect(formatPeriod({ start: '2026-06' }, 'ko')).toBe('2026년 6월 – 현재'))
  it('same start and end', () => expect(formatPeriod({ start: '2025', end: '2025' }, 'en')).toBe('2025'))
  it('approximate', () =>
    expect(formatPeriod({ start: '2023', end: '2025', approximate: true }, 'en')).toBe('c. 2023 – 2025'))
  it('approximate ko', () =>
    expect(formatPeriod({ start: '2023', end: '2025', approximate: true }, 'ko')).toBe('2023 – 2025 (대략)'))
  it('legacy "Present" end', () =>
    expect(formatPeriod({ start: '2025', end: 'Present' }, 'en')).toBe('2025 – Present'))
})
