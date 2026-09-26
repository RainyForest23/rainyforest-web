import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
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

const LINK_LABELS: Record<string, string> = {
  repo: 'Repository',
  paper: 'Paper',
  demo: 'Demo',
  slides: 'Slides',
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) notFound()

  const links = Object.entries(project.links ?? {})

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">{project.title}</h1>
      <p className="mt-2 text-fg-muted">{project.summary}</p>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-fg-muted">Role</dt>
        <dd>
          {project.role}
          {project.teamSize ? ` (team of ${project.teamSize})` : ''}
        </dd>
        <dt className="text-fg-muted">Period</dt>
        <dd>{formatPeriod(project.period)}</dd>
        <dt className="text-fg-muted">Stack</dt>
        <dd>{project.stack.join(', ')}</dd>
      </dl>
      {links.length > 0 ? (
        <p className="mt-4 text-sm">
          {links.map(([key, href]) => (
            <a key={key} href={href} className="mr-4 underline">
              {LINK_LABELS[key] ?? key}
            </a>
          ))}
        </p>
      ) : null}
      <div className="mt-10">
        <Prose source={project.body} />
      </div>
    </main>
  )
}
