import type { Metadata } from 'next'
import Link from 'next/link'
import { PostList } from '@/components/site/post-list'
import { loadPosts, tagIndex } from '@/lib/content/posts'

export const metadata: Metadata = {
  title: 'Blog — Woorim Shin',
  description: 'Notes on cloud infrastructure, AI systems and problem solving.',
}

export default function BlogPage() {
  const posts = loadPosts()
  const tags = [...tagIndex(posts)]
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Blog</h1>
      <p className="mt-2 text-fg-muted">
        Most posts are in Korean, each with an English summary.{' '}
        <a href="/feed.xml" className="underline">RSS</a>
      </p>
      <div className="mt-10">
        <PostList posts={posts} />
      </div>
      <h2 className="mt-16 text-sm font-semibold text-fg-muted">Tags</h2>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {tags.map(([tag, tagged]) => (
          <Link key={tag} href={`/blog/tags/${tag}/`} className="hover:underline">
            {tag} ({tagged.length})
          </Link>
        ))}
      </p>
    </main>
  )
}
