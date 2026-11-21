import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// 수식 HTML은 rehype-katex 안의 katex가 만들고, CSS는 우리가 설치한 katex에서 온다.
// 두 버전이 다르면 빌드는 되지만 위첨자·분수가 겹쳐 보인다 (2026-11에 실제로 겪음).
describe('katex', () => {
  it('is the same version for the HTML (rehype-katex) and the CSS (our dependency)', () => {
    const require = createRequire(import.meta.url)
    const css = require('katex/package.json').version
    const fromRehype = createRequire(require.resolve('rehype-katex'))
    const html = fromRehype('katex/package.json').version
    expect(css).toBe(html)
  })
})
