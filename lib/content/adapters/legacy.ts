import matter from 'gray-matter'
import type { Post } from '../model'

/** gray-matter turns unquoted YAML dates into Date objects; keep them as YYYY-MM-DD. */
function toDateString(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return typeof value === 'string' ? value : undefined
}

export function parseLegacyPost(fileName: string, raw: string): Post {
  const { data, content } = matter(raw)
  return {
    slug: fileName.replace(/\.mdx?$/, ''),
    title: data.title,
    summaryEn: data.summary_en,
    lang: data.lang,
    date: toDateString(data.date) ?? '',
    updated: toDateString(data.updated),
    tags: data.tags ?? [],
    source: 'legacy',
    body: content,
    outgoing: [],
  }
}
