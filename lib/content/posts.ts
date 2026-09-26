import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseLegacyPost } from './adapters/legacy'
import type { Post } from './model'
import { findMissingAssets, validatePosts } from './validate'

const LEGACY_DIR = join(process.cwd(), 'content/legacy')
const PUBLIC_DIR = join(process.cwd(), 'public')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
}

export function loadPosts(): Post[] {
  const posts = readdirSync(LEGACY_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => parseLegacyPost(f, readFileSync(join(LEGACY_DIR, f), 'utf8')))

  const errors = [
    ...validatePosts(posts),
    ...findMissingAssets(posts, (p) => existsSync(join(PUBLIC_DIR, p))),
  ]
  if (errors.length > 0) throw new Error(`blog content is invalid:\n  ${errors.join('\n  ')}`)
  return sortPosts(posts)
}

export function getPost(slug: string): Post | undefined {
  return loadPosts().find((p) => p.slug === slug)
}

export function tagIndex(posts: Post[]): Map<string, Post[]> {
  const index = new Map<string, Post[]>()
  for (const p of sortPosts(posts)) {
    for (const tag of p.tags) index.set(tag, [...(index.get(tag) ?? []), p])
  }
  return new Map([...index].sort(([a], [b]) => a.localeCompare(b)))
}

/** Parses the string by hand: new Date('2026-05-06') is UTC and can print as the 5th. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}, ${year}`
}
