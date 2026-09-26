import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Prose } from '@/components/site/prose'
import { formatDate, getPost, loadPosts } from '@/lib/content/posts'

export function generateStaticParams() {
  return loadPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return { title: `${post.title} — Woorim Shin`, description: post.summaryEn }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm text-fg-muted">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        {post.updated && post.updated !== post.date ? ` — updated ${formatDate(post.updated)}` : ''}
      </p>
      <h1 className="mt-2 text-3xl font-semibold">{post.title}</h1>
      {post.lang === 'ko' ? (
        <p className="mt-4 border-l-2 border-line pl-4 text-fg-muted">
          <span className="font-medium">In English:</span> {post.summaryEn}
        </p>
      ) : null}
      <p className="mt-4 flex flex-wrap gap-x-3 text-sm">
        {post.tags.map((tag) => (
          <Link key={tag} href={`/blog/tags/${tag}/`} className="text-fg-muted hover:underline">
            #{tag}
          </Link>
        ))}
      </p>
      <article className="mt-10" lang={post.lang}>
        <Prose source={post.body} />
      </article>
    </main>
  )
}
