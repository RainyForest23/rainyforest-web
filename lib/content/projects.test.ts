import { describe, expect, it } from 'vitest'
import type { Project } from './model'
import { sortProjects } from './projects'
import { validateProjects } from './validate'

function project(overrides: Partial<Project>): Project {
  return {
    slug: 's',
    title: 't',
    summary: 'one line',
    period: { start: '2025-01' },
    role: 'Independent Developer',
    stack: ['Rust'],
    category: 'systems',
    featured: false,
    body: '',
    ...overrides,
  }
}

describe('sortProjects', () => {
  it('puts featured projects first', () => {
    const sorted = sortProjects([
      project({ slug: 'plain', period: { start: '2026-01', end: '2026-06' } }),
      project({ slug: 'star', featured: true, period: { start: '2020-01', end: '2020-02' } }),
    ])
    expect(sorted.map((p) => p.slug)).toEqual(['star', 'plain'])
  })

  it('puts ongoing work before finished work', () => {
    const sorted = sortProjects([
      project({ slug: 'done', period: { start: '2026-01', end: '2026-06' } }),
      project({ slug: 'ongoing', period: { start: '2025-01' } }),
    ])
    expect(sorted.map((p) => p.slug)).toEqual(['ongoing', 'done'])
  })

  it('orders finished work by end date, newest first', () => {
    const sorted = sortProjects([
      project({ slug: 'older', period: { start: '2024-01', end: '2024-06' } }),
      project({ slug: 'newer', period: { start: '2025-01', end: '2025-06' } }),
    ])
    expect(sorted.map((p) => p.slug)).toEqual(['newer', 'older'])
  })
})

describe('validateProjects', () => {
  it('accepts a well-formed set', () => {
    expect(validateProjects([project({ slug: 'a' }), project({ slug: 'b' })])).toEqual([])
  })

  it('rejects duplicate slugs', () => {
    expect(validateProjects([project({ slug: 'a' }), project({ slug: 'a' })]).join(' ')).toContain(
      'duplicate slug',
    )
  })

  it('rejects a missing required field', () => {
    const broken = project({ slug: 'a', role: '' })
    expect(validateProjects([broken]).join(' ')).toContain('role')
  })

  it('rejects an unknown category', () => {
    const broken = project({ slug: 'a', category: 'marketing' as Project['category'] })
    expect(validateProjects([broken]).join(' ')).toContain('category')
  })

  it('rejects an end date earlier than the start date', () => {
    const broken = project({ slug: 'a', period: { start: '2026-05', end: '2026-01' } })
    expect(validateProjects([broken]).join(' ')).toContain('end')
  })
})
