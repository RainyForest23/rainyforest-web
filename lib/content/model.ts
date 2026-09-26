export type Source = 'vault' | 'legacy'

export interface Post {
  slug: string
  title: string
  summaryEn: string
  lang: 'ko' | 'en'
  date: string
  updated?: string
  tags: string[]
  source: Source
  status?: 'seed' | 'growing' | 'evergreen'
  project?: string
  body: string
  outgoing: string[]
}

export const PROJECT_CATEGORIES = ['research', 'ai', 'systems', 'data'] as const
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]

export interface Project {
  slug: string
  title: string
  summary: string
  outcome?: string
  /** Dates are "YYYY-MM" or "YYYY". No end means the work is ongoing. */
  period: { start: string; end?: string }
  role: string
  teamSize?: number
  stack: string[]
  category: ProjectCategory
  links?: { repo?: string; paper?: string; demo?: string; slides?: string }
  featured: boolean
  series?: string
  body: string
}

export interface LinkGraph {
  nodes: { slug: string; title: string; tags: string[] }[]
  edges: { from: string; to: string }[]
}
