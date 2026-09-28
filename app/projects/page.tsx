import type { Metadata } from 'next'
import { FilterableList } from '@/components/site/filterable-list'
import { PageHero } from '@/components/site/page-hero'
import { formatPeriodCompact } from '@/lib/content/format'
import { PROJECT_CATEGORIES, type ProjectCategory } from '@/lib/content/model'
import { loadProjects } from '@/lib/content/projects'

export const metadata: Metadata = {
  title: 'Projects — Woorim Shin',
  description: 'Selected engineering and research projects.',
}

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  research: 'Research',
  ai: 'AI',
  systems: 'Systems',
  data: 'Data',
}

export default function ProjectsPage() {
  const projects = loadProjects()
  return (
    <>
      <PageHero
        eyebrow="02 · Projects"
        title="Projects"
        lede="Case studies in AI systems, speech recognition and energy measurement: the problem, the decisions and what came of them."
      />
      <FilterableList
        placeholder="Search title, summary or stack"
        noun={['project', 'projects']}
        groups={PROJECT_CATEGORIES.map((c) => ({ label: CATEGORY_LABELS[c], value: c }))}
        items={projects.map((project) => ({
          key: project.slug,
          date: formatPeriodCompact(project.period),
          href: `/projects/${project.slug}/`,
          title: project.title,
          summary: project.summary,
          note: project.outcome,
          tags: project.stack.map((label) => ({ label })),
          group: project.category,
        }))}
      />
    </>
  )
}
