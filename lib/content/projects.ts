import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseProject } from './adapters/projects'
import type { Project } from './model'
import { validateProjects } from './validate'

const DIR = join(process.cwd(), 'content/projects')

export function sortProjects(projects: Project[]): Project[] {
  const rank = (p: Project) => (p.featured ? 0 : 1)
  return [...projects].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    const ongoing = (p: Project) => (p.period.end ? 1 : 0)
    if (ongoing(a) !== ongoing(b)) return ongoing(a) - ongoing(b)
    const byEnd = (b.period.end ?? '').localeCompare(a.period.end ?? '')
    return byEnd !== 0 ? byEnd : b.period.start.localeCompare(a.period.start)
  })
}

export function loadProjects(): Project[] {
  const projects = readdirSync(DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => parseProject(f, readFileSync(join(DIR, f), 'utf8')))

  const errors = validateProjects(projects)
  if (errors.length > 0) {
    throw new Error(`content/projects is invalid:\n  ${errors.join('\n  ')}`)
  }
  return sortProjects(projects)
}

export function getProject(slug: string): Project | undefined {
  return loadProjects().find((p) => p.slug === slug)
}
