import matter from 'gray-matter'
import type { Project } from '../model'

/** Parsing never throws on bad data; validateProjects collects every problem at once. */
export function parseProject(fileName: string, raw: string): Project {
  const { data, content } = matter(raw)
  return {
    slug: fileName.replace(/\.mdx?$/, ''),
    title: data.title,
    summary: data.summary,
    outcome: data.outcome,
    period: data.period,
    role: data.role,
    teamSize: data.teamSize,
    stack: data.stack ?? [],
    category: data.category,
    links: data.links,
    featured: data.featured === true,
    series: data.series,
    body: content,
  }
}
