import { describe, expect, it } from 'vitest'
import { t, ui } from './ui'

describe('ui dictionary', () => {
  it('has every key in both languages', () => {
    expect(Object.keys(ui.ko).sort()).toEqual(Object.keys(ui.en).sort())
  })

  it('returns the text for the given language', () => {
    expect(t('en', 'lang.switch')).toBe('한국어')
    expect(t('ko', 'lang.switch')).toBe('English')
  })
})
