import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LINK = /(?:href|src)="(\/[^"#?]*)[^"]*"/g

/** Same resolution as html_handling: "auto-trailing-slash" in wrangler.jsonc. */
function toFile(path: string): string {
  const clean = decodeURIComponent(path).replace(/^\//, '')
  if (clean === '' || clean.endsWith('/')) return `${clean}index.html`
  return clean.split('/').pop()!.includes('.') ? clean : `${clean}/index.html`
}

export function findBrokenLinks(pages: Map<string, string>, files: Set<string>): string[] {
  const broken: string[] = []
  for (const [page, html] of pages) {
    for (const [, path] of html.matchAll(LINK)) {
      if (path.startsWith('/_next/')) continue
      if (!files.has(toFile(path))) broken.push(`${page} -> ${path}`)
    }
  }
  return [...new Set(broken)]
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full) : [full]
  })
}

function main(): void {
  const out = join(process.cwd(), 'out')
  const all = listFiles(out).map((f) => relative(out, f))
  const pages = new Map(
    all.filter((f) => f.endsWith('.html')).map((f) => [f, readFileSync(join(out, f), 'utf8')] as const),
  )
  const broken = findBrokenLinks(pages, new Set(all))
  if (broken.length === 0) {
    console.log(`check-links: ok (${pages.size} pages)`)
    return
  }
  broken.forEach((b) => console.error(`broken link: ${b}`))
  process.exit(1)
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main()
}
