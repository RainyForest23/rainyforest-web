import { MDXRemote } from 'next-mdx-remote-client/rsc'

export function Prose({ source }: { source: string }) {
  return (
    <div className="prose-body">
      <MDXRemote source={source} />
    </div>
  )
}
