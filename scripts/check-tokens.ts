import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Violation {
  path: string
  line: number
  match: string
}

export const TOKENS_FILE = 'app/tokens.css'

const HEX_COLOR = /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g
const PX_VALUE = /\b\d+(?:\.\d+)?px\b/g
const ROOTS = ['app', 'components']
const CHECKED = /\.(css|tsx?|mdx)$/

export function findViolations(path: string, content: string): Violation[] {
  if (path === TOKENS_FILE) return []
  const violations: Violation[] = []
  content.split('\n').forEach((text, index) => {
    for (const pattern of [HEX_COLOR, PX_VALUE]) {
      for (const m of text.matchAll(pattern)) {
        violations.push({ path, line: index + 1, match: m[0] })
      }
    }
  })
  return violations
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full) : [full]
  })
}

function main(): void {
  const root = process.cwd()
  const violations = ROOTS.flatMap((dir) => listFiles(join(root, dir)))
    .filter((file) => CHECKED.test(file) && !file.endsWith('.test.ts'))
    .flatMap((file) => findViolations(relative(root, file), readFileSync(file, 'utf8')))

  if (violations.length === 0) {
    console.log('check-tokens: ok')
    return
  }
  for (const v of violations) {
    console.error(`${v.path}:${v.line}  ${v.match}  (move this value into ${TOKENS_FILE})`)
  }
  process.exit(1)
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main()
}
