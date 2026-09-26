import Link from 'next/link'
import { formatPeriod } from '@/lib/content/format'
import type { Project } from '@/lib/content/model'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <h3 className="text-lg font-semibold">
        <Link href={`/projects/${project.slug}/`} className="hover:underline">
          {project.title}
        </Link>
      </h3>
      <p className="mt-1 text-fg-muted">{project.summary}</p>
      <p className="mt-2 text-sm text-fg-muted">
        {project.role}
        {project.teamSize ? ` (team of ${project.teamSize})` : ''} — {formatPeriod(project.period)} —{' '}
        {project.stack.join(', ')}
      </p>
      {project.outcome ? <p className="mt-2 text-sm">{project.outcome}</p> : null}
    </article>
  )
}
