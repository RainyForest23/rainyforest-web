import { describe, expect, it } from 'vitest'
import { loadResume, validateResume } from './resume'

describe('validateResume', () => {
  it('accepts the real resume file', () => {
    expect(validateResume(loadResume())).toEqual([])
  })

  it('rejects a resume without basics.name', () => {
    expect(validateResume({ basics: { label: 'x' } }).join(' ')).toContain('name')
  })

  it('rejects a work entry without a position', () => {
    const errors = validateResume({
      basics: { name: 'X', label: 'y', email: 'a@b.c', summary: 's' },
      education: [],
      work: [{ name: 'Acme', startDate: '2020-01-01' }],
      publications: [],
      talks: [],
      awards: [],
      skills: [],
      languages: [],
    })
    expect(errors.join(' ')).toContain('position')
  })

  it('rejects dates that are not ISO or "Present"', () => {
    const errors = validateResume({
      basics: { name: 'X', label: 'y', email: 'a@b.c', summary: 's' },
      education: [],
      work: [{ name: 'Acme', position: 'Dev', startDate: 'Jan 2020' }],
      publications: [],
      talks: [],
      awards: [],
      skills: [],
      languages: [],
    })
    expect(errors.join(' ')).toContain('startDate')
  })
})

describe('loadResume', () => {
  it('keeps the JSON Resume projects array empty (projects live in content/projects)', () => {
    expect(loadResume().projects ?? []).toEqual([])
  })

  it('carries the sections the CV page renders', () => {
    const resume = loadResume()
    expect(resume.work.length).toBeGreaterThan(0)
    expect(resume.education.length).toBeGreaterThan(0)
    expect(resume.publications.length).toBeGreaterThan(0)
    expect(resume.talks.length).toBeGreaterThan(0)
    expect(resume.skills.length).toBeGreaterThan(0)
  })
})
