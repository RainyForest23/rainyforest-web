// 빌드 결과(dist/)가 "빌드는 됐지만 틀린" 상태가 아닌지 확인한다.
//  1. 있어야 할 페이지가 다 있는가
//  2. 옛 주소(redirects.json)가 가리키는 페이지가 있는가
//  3. 공개하지 않기로 한 문자열(학점)이 어디에도 없는가
//  4. 모든 페이지에 영어·한국어 대체 링크(hreflang)가 있고, 그 대상이 있는가
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCALES, localePath } from '../src/i18n/paths'
import { toFile } from './check-links'

/** 공개 금지 문자열 (spec §3). */
const FORBIDDEN = [/GPA/i, /0\.00\s*\/\s*4\.5/]
const TEXT_FILE = /\.(html|xml|txt)$/

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
    ...forbiddenText(texts, FORBIDDEN).map((p) => `private text: ${p}`),
    ...missingAlternates(pages).map((p) => `hreflang: ${p}`),
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
