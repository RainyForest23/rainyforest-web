import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

/**
 * One MDX configuration for every page and for the tests.
 * remark-gfm: tables, strikethrough, autolinks. remark-math + rehype-katex: $inline$ and $$block$$ math.
 * A literal dollar sign in prose must be written as \$.
 */
export const mdxOptions = {
  remarkPlugins: [remarkGfm, remarkMath],
  rehypePlugins: [rehypeKatex],
}
