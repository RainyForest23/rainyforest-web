// 빌드 결과(dist/)가 "빌드는 됐지만 틀린" 상태가 아닌지 확인한다.
//  1. 있어야 할 페이지가 다 있는가
//  2. 옛 주소(redirects.json)가 가리키는 페이지가 있는가
//  3. 공개하지 않기로 한 문자열(학점)이 어디에도 없는가
//  4. 모든 페이지에 영어·한국어 대체 링크(hreflang)가 있고, 그 대상이 있는가
//  5. 어느 페이지도 가리키지 않는 파일이 섞여 있지 않은가 (public/은 링크가 없어도 통째로 공개된다)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCALES, localePath } from '../src/i18n/paths'
import { linkedPaths, toFile } from './check-links'

/** 공개 금지 문자열 (spec §3): 학점. 실제 값은 적지 않고 모양으로 찾는다. */
export const FORBIDDEN = [/\bGPA\b/i, /학점\s*\d/, /\b\d\.\d{1,2}\s*\/\s*4\.[35]\b/]
const TEXT_FILE = /\.(html|xml|txt)$/

/**
 * 어느 페이지도 가리키지 않아도 되는 파일.
 * public/에 파일을 넣으면 링크가 없어도 공개된다. 여기에 없고 링크도 없는 파일은 검사가 실패한다.
 */
const ALLOWED_ORPHANS: (string | RegExp)[] = [
  '_headers',
  /^sitemap-.*\.xml$/,
  // 공개 학회 포스터. content/projects가 2단계에서 경험 페이지가 되면 거기서 링크된다.
  'projects/convpeft/convpeft-poster.pdf',
]

export function missingPages(files: Set<string>, required: string[]): string[] {
  return required.filter((path) => !files.has(toFile(path)))
}

/** redirects는 { 옛 주소: 새 주소 }. 새 주소가 빌드 결과에 없으면 알려 준다. */
export function brokenRedirects(redirects: Record<string, string>, files: Set<string>): string[] {
  return Object.entries(redirects)
    .filter(([, to]) => !files.has(toFile(to)))
    .map(([from, to]) => `${from} -> ${to}`)
}

export function forbiddenText(pages: Map<string, string>, patterns: RegExp[]): string[] {
  const found: string[] = []
  for (const [file, text] of pages) {
    for (const pattern of patterns) {
      if (pattern.test(text)) found.push(`${file}: ${pattern}`)
    }
  }
  return found
}

/** 우연히 걸릴 수 있는 빌드 부산물(스타일, 스크립트, 해시가 든 이름)을 뺀다. 속성 값은 남긴다. */
export function scannable(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/\sdata-astro-cid-[a-z0-9]+/g, '')
    .replace(/\/_astro\/[^"'\s)]*/g, '')
}

/** HTML이 아닌 파일 가운데 어느 페이지도 가리키지 않고 허용 목록에도 없는 것. */
export function orphanFiles(pages: Map<string, string>, files: Set<string>, allowed: (string | RegExp)[]): string[] {
  const linked = new Set([...pages.values()].flatMap(linkedPaths).map(toFile))
  const isAllowed = (file: string) => allowed.some((rule) => (typeof rule === 'string' ? rule === file : rule.test(file)))
  return [...files]
    .filter((file) => !file.endsWith('.html') && !file.startsWith('_astro/'))
    .filter((file) => !linked.has(file) && !isAllowed(file))
    .sort()
}

const LINK_TAG = /<link\b[^>]*>/g
const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]

/** 페이지마다 언어별 hreflang 링크가 있는지, 그 링크가 실제 페이지를 가리키는지 본다. */
export function missingAlternates(pages: Map<string, string>): string[] {
  const problems: string[] = []
  for (const [file, html] of pages) {
    if (file === '404.html' || html.includes('http-equiv="refresh"')) continue

    const hrefByLang = new Map<string, string>()
    for (const tag of html.match(LINK_TAG) ?? []) {
      const lang = attribute(tag, 'hreflang')
      const href = attribute(tag, 'href')
      if (attribute(tag, 'rel') === 'alternate' && lang && href) hrefByLang.set(lang, href)
    }

    for (const locale of LOCALES) {
      const href = hrefByLang.get(locale)
      if (!href) {
        problems.push(`${file}: ${locale}`)
        continue
      }
      // 링크는 전체 주소(https://…)일 수 있다. 경로만 꺼내서 본다.
      const path = new URL(href, 'http://localhost').pathname
      if (!pages.has(toFile(path))) problems.push(`${file}: ${locale} -> ${path} is not built`)
    }
  }
  return problems
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full) : [full]
  })
}

function main(): void {
  const root = process.cwd()
  const dist = join(root, 'dist')
  const all = listFiles(dist).map((file) => relative(dist, file))
  const files = new Set(all)
  const read = (file: string) => readFileSync(join(dist, file), 'utf8')
  const texts = new Map(all.filter((file) => TEXT_FILE.test(file)).map((file) => [file, read(file)] as const))
  const pages = new Map([...texts].filter(([file]) => file.endsWith('.html')))

  const legacyDir = join(root, 'content/legacy')
  const postIds = readdirSync(legacyDir)
    .filter((name) => name.endsWith('.mdx'))
    .map((name) => name.replace(/\.mdx$/, ''))
  const paths = ['/', '/cv/', '/blog/', ...postIds.map((id) => `/blog/${id}/`)]
  const required = [
    ...LOCALES.flatMap((locale) => paths.map((path) => localePath(locale, path))),
    '/404.html',
    '/feed.xml',
    '/sitemap-index.xml',
  ]
  const redirects = JSON.parse(readFileSync(join(legacyDir, 'redirects.json'), 'utf8')) as Record<string, string>

  const problems = [
    ...missingPages(files, required).map((p) => `missing page: ${p}`),
    ...brokenRedirects(redirects, files).map((p) => `redirect target is not built: ${p}`),
    ...forbiddenText(new Map([...texts].map(([file, text]) => [file, scannable(text)])), FORBIDDEN).map(
      (p) => `private text: ${p}`,
    ),
    ...missingAlternates(pages).map((p) => `hreflang: ${p}`),
    ...orphanFiles(pages, files, ALLOWED_ORPHANS).map(
      (p) => `file is public but no page links to it: ${p} (link it, remove it, or add it to ALLOWED_ORPHANS)`,
    ),
  ]

  if (problems.length === 0) {
    console.log(`check-dist: ok (${required.length} required pages, ${Object.keys(redirects).length} redirects, ${texts.size} files scanned)`)
    return
  }
  problems.forEach((problem) => console.error(problem))
  process.exit(1)
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main()
}
