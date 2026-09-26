import { PROJECT_CATEGORIES, type Post, type Project } from './model'

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

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const LANGS = ['ko', 'en'] as const

export function validatePosts(posts: Post[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const p of posts) {
    const where = `blog/${p.slug}`
    if (seen.has(p.slug)) errors.push(`${where}: duplicate slug`)
    seen.add(p.slug)

    if (!KEBAB.test(p.slug)) errors.push(`${where}: slug must be lowercase ASCII kebab-case`)
    if (!p.title) errors.push(`${where}: title is required`)
    if (!p.summaryEn) errors.push(`${where}: summary_en is required`)
    if (!LANGS.includes(p.lang)) errors.push(`${where}: lang must be one of ${LANGS.join(', ')}`)
    if (!ISO_DATE.test(p.date)) errors.push(`${where}: date must be YYYY-MM-DD`)
    if (p.updated && !ISO_DATE.test(p.updated)) errors.push(`${where}: updated must be YYYY-MM-DD`)
    for (const tag of p.tags) {
      if (!KEBAB.test(tag)) errors.push(`${where}: tag "${tag}" must be lowercase ASCII kebab-case`)
    }
  }
  return errors
}

const LOCAL_IMAGE = /!\[[^\]]*\]\((\/[^)\s]+)\)/g

export function findMissingAssets(posts: Post[], exists: (publicPath: string) => boolean): string[] {
  return posts.flatMap((p) =>
    [...p.body.matchAll(LOCAL_IMAGE)]
      .map((m) => m[1])
      .filter((path) => !exists(path))
      .map((path) => `blog/${p.slug}: missing image ${path}`),
  )
}
