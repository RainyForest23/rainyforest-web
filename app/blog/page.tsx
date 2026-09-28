import type { Metadata } from 'next'
import Link from 'next/link'
import { FilterableList } from '@/components/site/filterable-list'
import { PageHero, SectionLabel } from '@/components/site/page-hero'
import { loadPosts, tagIndex } from '@/lib/content/posts'

export const metadata: Metadata = {
  title: 'Blog — Woorim Shin',
  description: 'Notes on cloud infrastructure, AI systems and problem solving.',
}

export default function BlogPage() {
  const posts = loadPosts()
  const tags = [...tagIndex(posts)].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  return (
    <>
      <PageHero
        eyebrow="03 · Blog"
        title="Blog"
        lede={
          <>
            Notes on cloud infrastructure, AI systems and problem solving. Most posts are in Korean, each with an
            English summary. <a href="/feed.xml" className="underline underline-offset-4">RSS</a>
          </>
        }
      />
      <FilterableList
        placeholder="Search title, summary or tag"
        noun={['post', 'posts']}
        groups={[
          { label: 'Korean', value: 'ko' },
          { label: 'English', value: 'en' },
        ]}
        items={posts.map((post) => ({
          key: post.slug,
          date: post.date,
          href: `/blog/${post.slug}/`,
          title: post.title,
          summary: post.summaryEn,
          lang: post.lang,
          tags: post.tags.map((tag) => ({ label: tag, href: `/blog/tags/${tag}/` })),
          group: post.lang,
        }))}
      />

      <SectionLabel>Tags</SectionLabel>
      <div className="tag-cloud">
        {tags.map(([tag, tagged]) => (
          <Link key={tag} href={`/blog/tags/${tag}/`} className="bp6-tag bp6-minimal bp6-interactive bp6-large">
            <span className="bp6-fill">
              {tag} <span className="text-fg-subtle">{tagged.length}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
