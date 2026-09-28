import Link from 'next/link'
import { EntryRow } from '@/components/site/entry-row'
import { IndexCell } from '@/components/site/index-cell'
import { PageHero, SectionLabel } from '@/components/site/page-hero'
import { formatPeriodCompact } from '@/lib/content/format'
import { loadPosts } from '@/lib/content/posts'
import { loadProjects } from '@/lib/content/projects'
import { loadResume } from '@/lib/cv/resume'

export default function Home() {
  const resume = loadResume()
  const projects = loadProjects()
  const featured = projects.filter((project) => project.featured)
  const posts = loadPosts()
  const recent = posts.slice(0, 5)

  return (
    <>
      <PageHero eyebrow={resume.basics.label} title={resume.basics.name} lede={resume.basics.summary} />

      <nav aria-label="Sections" className="index-grid">
        <IndexCell num="01" href="/cv/" title="CV" desc="Experience, publications and talks." />
        <IndexCell num="02" href="/projects/" title="Projects" desc={`${projects.length} case studies in AI systems and research.`} />
        <IndexCell num="03" href="/blog/" title="Blog" desc={`${posts.length} posts on cloud, AI systems and problem solving.`} />
      </nav>

      <SectionLabel action={<Link href="/projects/">All projects</Link>}>Selected work</SectionLabel>
      <ul>
        {featured.map((project) => (
          <EntryRow
            key={project.slug}
            date={formatPeriodCompact(project.period)}
            href={`/projects/${project.slug}/`}
            title={project.title}
            summary={project.summary}
            note={project.outcome}
            tags={project.stack.slice(0, 5).map((label) => ({ label }))}
          />
        ))}
      </ul>

      <SectionLabel action={<Link href="/blog/">All posts</Link>}>Recent writing</SectionLabel>
      <ul>
        {recent.map((post) => (
          <EntryRow
            key={post.slug}
            date={post.date}
            href={`/blog/${post.slug}/`}
            title={post.title}
            summary={post.summaryEn}
            lang={post.lang}
            tags={post.tags.slice(0, 4).map((tag) => ({ label: tag, href: `/blog/tags/${tag}/` }))}
          />
        ))}
      </ul>
    </>
  )
}
