import { MDXRemote } from 'next-mdx-remote-client/rsc'
import { mdxOptions } from '@/lib/content/mdx'

export function Prose({ source }: { source: string }) {
  return (
    <div className="prose-body">
      <MDXRemote source={source} options={{ mdxOptions }} />
    </div>
  )
}
