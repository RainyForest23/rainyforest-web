import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PostList } from '@/components/site/post-list'
import { loadPosts, tagIndex } from '@/lib/content/posts'

export function generateStaticParams() {
  return [...tagIndex(loadPosts()).keys()].map((tag) => ({ tag }))
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params
  return { title: `#${tag} — Woorim Shin` }
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const posts = tagIndex(loadPosts()).get(tag)
  if (!posts) notFound()

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">#{tag}</h1>
      <p className="mt-2 text-fg-muted">
        {posts.length} {posts.length === 1 ? 'post' : 'posts'}
      </p>
      <div className="mt-10">
        <PostList posts={posts} />
      </div>
    </main>
  )
}
