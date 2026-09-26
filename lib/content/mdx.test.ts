import { evaluate } from '@mdx-js/mdx'
import { createElement } from 'react'
import * as runtime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { mdxOptions } from './mdx'

async function render(source: string): Promise<string> {
  const { default: Content } = await evaluate(source, { ...runtime, ...mdxOptions })
  return renderToStaticMarkup(createElement(Content))
}

describe('mdxOptions', () => {
  it('renders inline math with KaTeX', async () => {
    expect(await render('Then, for each workload $w_i$:')).toContain('class="katex"')
  })

  it('renders block math whose braces would otherwise be JSX expressions', async () => {
    // remark-math renders $$ as display math only when the delimiters sit on their own lines.
    const html = await render('$$\nE^{sys} = \\sum_{i=1}^{n} E_{w_i}\n$$')
    expect(html).toContain('katex-display')
  })

  it('keeps escaped dollar signs as prices, not math', async () => {
    const html = await render('Standard costs \\$0.023/GB and Infrequent Access \\$0.0125/GB.')
    expect(html).not.toContain('katex')
    expect(html).toContain('$0.023/GB')
    expect(html).toContain('$0.0125/GB')
  })

  it('renders GFM tables', async () => {
    expect(await render('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table>')
  })
})
