import { MDXRemote } from 'next-mdx-remote-client/rsc'
import remarkGfm from 'remark-gfm'

// remark-gfm is required for tables, strikethrough and autolinks:
// MDX only understands CommonMark without it.
export function Prose({ source }: { source: string }) {
  return (
    <div className="prose-body">
      <MDXRemote source={source} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />
    </div>
  )
}
