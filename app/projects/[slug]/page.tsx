import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AnchorButton, Callout, Document, Download, GitRepo, LinkIcon } from '@/components/bp'
import { EntryTags } from '@/components/site/entry-row'
import { PageHero } from '@/components/site/page-hero'
import { Prose } from '@/components/site/prose'
import { formatPeriod } from '@/lib/content/format'
import { getProject, loadProjects } from '@/lib/content/projects'

export function generateStaticParams() {
  return loadProjects().map((project) => ({ slug: project.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) return {}
  return { title: `${project.title} — Woorim Shin`, description: project.summary }
}

const LINKS = {
  repo: { label: 'Repository', icon: <GitRepo /> },
  paper: { label: 'Paper', icon: <Document /> },
  demo: { label: 'Demo', icon: <LinkIcon /> },
  slides: { label: 'Slides', icon: <Download /> },
} as const

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) notFound()

  const links = Object.entries(project.links ?? {}) as [keyof typeof LINKS, string][]

  return (
    <>
      <PageHero eyebrow="Project" title={project.title} lede={project.summary} compact>
        {links.length > 0 ? (
          <div className="link-row">
            {links.map(([key, href]) => (
              <AnchorButton key={key} href={href} icon={LINKS[key].icon} variant="outlined">
                {LINKS[key].label}
              </AnchorButton>
            ))}
          </div>
        ) : null}
      </PageHero>

      <dl className="meta-grid">
        <div className="meta-cell">
          <dt>Role</dt>
          <dd>
            {project.role}
            {project.teamSize ? ` · team of ${project.teamSize}` : ''}
          </dd>
        </div>
        <div className="meta-cell">
          <dt>Period</dt>
          <dd>{formatPeriod(project.period)}</dd>
        </div>
        <div className="meta-cell">
          <dt>Stack</dt>
          <dd>
            <EntryTags tags={project.stack.map((label) => ({ label }))} />
          </dd>
        </div>
      </dl>

      {project.outcome ? (
        <Callout title="Outcome" className="mb-12 max-w-3xl">
          {project.outcome}
        </Callout>
      ) : null}

      <Prose source={project.body} />
    </>
  )
}
