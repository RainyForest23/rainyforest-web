import { describe, expect, it } from 'vitest'
import { loadResume, parseResume } from './resume'

describe('loadResume', () => {
  it('reads content/resume.json', () => {
    expect(loadResume().basics.name).toBe('Woorim Shin')
  })
})

describe('parseResume', () => {
  it('names the file and the path of each problem', () => {
    expect(() => parseResume({ basics: {} })).toThrow(/content\/resume\.json is invalid:[\s\S]*basics\.name/)
  })
})
