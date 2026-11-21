import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resumeSchema } from './schema'

const valid = () => structuredClone(JSON.parse(readFileSync('content/resume.json', 'utf8')))

describe('resumeSchema', () => {
  it('accepts the real resume', () => {
    expect(resumeSchema.safeParse(valid()).success).toBe(true)
  })

  it('rejects a GPA score', () => {
    const r = valid()
    r.education[0].score = 'GPA 4.0/4.5'
    expect(resumeSchema.safeParse(r).success).toBe(false)
  })

  it('rejects an unknown field at any level', () => {
    const r = valid()
    r.basics.phone = '010-0000-0000'
    expect(resumeSchema.safeParse(r).success).toBe(false)
  })

  it('accepts YYYY-MM dates', () => {
    const r = valid()
    r.work[0].startDate = '2025-06'
    expect(resumeSchema.safeParse(r).success).toBe(true)
  })

  it('rejects a bad date', () => {
    const r = valid()
    r.work[0].startDate = 'June 2025'
    expect(resumeSchema.safeParse(r).success).toBe(false)
  })

  it('rejects a bad email', () => {
    const r = valid()
    r.basics.email = 'not-an-email'
    expect(resumeSchema.safeParse(r).success).toBe(false)
  })

  it('rejects non-empty projects', () => {
    const r = valid()
    r.projects = [{}]
    expect(resumeSchema.safeParse(r).success).toBe(false)
  })
})
