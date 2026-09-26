import { PROJECT_CATEGORIES, type Project } from './model'

const REQUIRED = ['title', 'summary', 'role', 'category'] as const

export function validateProjects(projects: Project[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const p of projects) {
    const where = `projects/${p.slug}`
    if (seen.has(p.slug)) errors.push(`${where}: duplicate slug`)
    seen.add(p.slug)

    for (const field of REQUIRED) {
      if (!p[field]) errors.push(`${where}: ${field} is required`)
    }
    if (!PROJECT_CATEGORIES.includes(p.category)) {
      errors.push(`${where}: category must be one of ${PROJECT_CATEGORIES.join(', ')}`)
    }
    if (p.stack.length === 0) errors.push(`${where}: stack must list at least one technology`)
    if (!p.period?.start) errors.push(`${where}: period.start is required`)
    if (p.period?.end && p.period.end < p.period.start) {
      errors.push(`${where}: period.end is earlier than period.start`)
    }
  }
  return errors
}
