import { describe, expect, it } from 'vitest'
import { parseProject } from './projects'

const raw = `---
title: "fcoinman: Linux Server Compromise Detector"
summary: Single-binary Linux compromise detector written in Rust
outcome: Found a CPU miner, GPU miner and IRC botnet on a live server
period:
  start: "2026-05"
role: Independent Developer
stack: [Rust, Linux]
category: systems
featured: true
links:
  repo: https://github.com/RainyForest23/fcoinman
---

## Origin

It started at 3am.
`

describe('parseProject', () => {
  it('derives the slug from the file name', () => {
    expect(parseProject('fcoinman.mdx', raw).slug).toBe('fcoinman')
  })

  it('reads the structured fields from frontmatter', () => {
    const project = parseProject('fcoinman.mdx', raw)
    expect(project.title).toBe('fcoinman: Linux Server Compromise Detector')
    expect(project.role).toBe('Independent Developer')
    expect(project.stack).toEqual(['Rust', 'Linux'])
    expect(project.category).toBe('systems')
    expect(project.featured).toBe(true)
    expect(project.period).toEqual({ start: '2026-05' })
    expect(project.links?.repo).toBe('https://github.com/RainyForest23/fcoinman')
  })

  it('keeps the body as MDX without the frontmatter', () => {
    const project = parseProject('fcoinman.mdx', raw)
    expect(project.body.trim().startsWith('## Origin')).toBe(true)
    expect(project.body).not.toContain('title:')
  })

  it('defaults featured to false when absent', () => {
    const without = raw.replace('featured: true\n', '')
    expect(parseProject('fcoinman.mdx', without).featured).toBe(false)
  })
})
