import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EntryRow } from '@/components/site/entry-row'
import { PageHero } from '@/components/site/page-hero'
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
    <>
      <PageHero
        eyebrow={<Link href="/blog/">03 · Blog</Link>}
        title={`#${tag}`}
        lede={`${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`}
        compact
      />
      <ul>
        {posts.map((post) => (
          <EntryRow
            key={post.slug}
            date={post.date}
            href={`/blog/${post.slug}/`}
            title={post.title}
            summary={post.summaryEn}
            lang={post.lang}
            tags={post.tags.map((t) => ({ label: t, href: `/blog/tags/${t}/` }))}
          />
        ))}
      </ul>
    </>
  )
}
