import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Callout } from '@/components/bp'
import { EntryTags } from '@/components/site/entry-row'
import { PageHero } from '@/components/site/page-hero'
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

  const updated = post.updated && post.updated !== post.date ? ` · updated ${formatDate(post.updated)}` : ''

  return (
    <>
      <PageHero
        eyebrow={
          <time dateTime={post.date}>
            {formatDate(post.date)}
            {updated}
          </time>
        }
        title={post.title}
        lang={post.lang}
        compact
      >
        <EntryTags tags={post.tags.map((tag) => ({ label: tag, href: `/blog/tags/${tag}/` }))} />
      </PageHero>

      {post.lang === 'ko' ? (
        <Callout title="In English" className="mb-12 max-w-3xl">
          {post.summaryEn}
        </Callout>
      ) : null}

      {/* lang makes screen readers and hyphenation treat Korean bodies as Korean. */}
      <article lang={post.lang}>
        <Prose source={post.body} />
      </article>
    </>
  )
}
