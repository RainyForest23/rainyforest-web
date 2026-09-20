# Stage 1: Walking Skeleton 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 빈 Next.js 사이트를 실제 도메인에 HTTPS로 배포하고, main에 push하면 자동 배포된 뒤 스모크 테스트가 통과하는 상태까지 만든다.

**Architecture:** Next.js static export 결과물을 비공개 S3에 올리고, CloudFront(OAC)로 서빙한다. viewer-request CloudFront Function이 www → apex 리다이렉트, KVS 리다이렉트 맵 조회, 디렉터리 경로 보정을 맡는다. 인프라는 CDK 스택 하나(us-east-1)이며, GitHub Actions는 OIDC 역할로 콘텐츠만 배포한다. DNS는 Cloudflare(DNS only)다.

**Tech Stack:** Node 24, npm, TypeScript ~6.0.3, Next.js 16, React 19, Tailwind CSS 4, Vitest 5, tsx, AWS CDK v2 (aws-cdk-lib 2.x), GitHub Actions

**Spec:** `docs/superpowers/specs/2026-09-19-personal-site-design.md` (§3, §7, §8.1, §9, §10 1단계)

## Global Constraints

- 패키지 매니저는 npm이다(`package-lock.json` 커밋). pnpm은 쓰지 않는다.
- Node 24(`.nvmrc`). TypeScript는 `~6.0.3`으로 고정한다. 7.x는 Go 네이티브 컴파일러로, Next 16의 타입 검사와 함께 쓸 수 있는지 검증되지 않았다.
- Next 설정: `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`.
- AWS 리전은 `us-east-1` 하나, 스택은 `RainyforestWeb` 하나다.
- 이번 단계에는 Lambda가 없다. 커스텀 리소스용 Lambda도 만들지 않는다(`autoDeleteObjects`, `BucketDeployment`, L2 `OpenIdConnectProvider` 금지). CDK 테스트로 강제한다.
- Cloudflare 레코드는 전부 DNS only(프록시 끔)다.
- GitHub에 장기 AWS 액세스 키를 두지 않는다. 배포는 OIDC 역할로만 한다.
- `app/tokens.css` 밖에서는 hex 색상과 px 값을 쓰지 않는다(§8.1).
- 사이트 문구와 코드 주석은 영문으로 쓴다(스펙 D5, public 레포).
- 레포는 `RainyForest23/rainyforest-web`, 기본 브랜치는 `main`이다.
- Claude가 만든 커밋 메시지는 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`으로 끝낸다.

## 담당 제안

사용자는 웹 개발을 직접 경험하고 싶어 한다. 실행 전에 태스크별 담당을 확정한다.

| Task | 제안 | 이유 |
|---|---|---|
| 1. Next 스켈레톤 | Claude | 보일러플레이트 |
| 2. 토큰 규칙 검사 | Claude | 작은 유틸리티 |
| 3. CloudFront Function | 직접 | 50줄 안팎. 엣지 런타임의 제약(import 불가, 전역 `handler`)을 체감할 수 있다 |
| 4. CDK 스택 | 직접 | SAA 지식을 실제 IaC로 옮기는 핵심이자 면접 소재 |
| 5. CI·배포 스크립트 | 함께 | OIDC 신뢰 관계와 무중단 업로드 순서를 이해해야 운영할 수 있다 |
| 6. 첫 배포 | 직접 (필수) | AWS SSO, 도메인, Cloudflare 계정 권한이 필요하다 |

## File Structure

```
rainyforest-web/
├─ .github/workflows/
│   ├─ ci.yml                 PR 검증. deploy.yml이 재사용 (workflow_call)
│   └─ deploy.yml             main push / repository_dispatch → 검증 → 배포 → 스모크
├─ app/
│   ├─ layout.tsx             <html>, 메타데이터, build-sha 메타 태그
│   ├─ page.tsx               임시 홈
│   ├─ not-found.tsx          out/404.html 생성
│   ├─ globals.css            Tailwind + tokens.css import
│   └─ tokens.css             룩 정의의 유일한 위치 (중립 임시값)
├─ infra/
│   ├─ bin/app.ts             CDK 앱 진입점. 설정값 검증
│   ├─ lib/site-stack.ts      S3, ACM, KVS, CF Function, CloudFront, OIDC 역할, Budget
│   ├─ lib/site-stack.test.ts CDK assertion 테스트
│   └─ functions/
│       ├─ viewer-request.js       CloudFront Function (cloudfront-js-2.0)
│       └─ viewer-request.test.ts  Vitest로 런타임 흉내
├─ scripts/
│   ├─ check-tokens.ts        토큰 규칙 검사 (함수 + CLI)
│   ├─ check-tokens.test.ts
│   ├─ deploy.sh              S3 업로드 순서 + 무효화
│   └─ smoke.sh               배포 후 실제 도메인 검사
├─ .gitignore  .nvmrc  cdk.json  next.config.ts  package.json
├─ postcss.config.mjs  tsconfig.json  vitest.config.ts
└─ README.md                  개요 + 운영 런북 (DNS, 첫 배포)
```

---

### Task 1: Next.js 스켈레톤과 프로젝트 기반

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/not-found.tsx`, `app/globals.css`, `app/tokens.css`

**Interfaces:**
- Produces: npm 스크립트 `dev`, `build`, `typecheck`, `test`, `check:tokens`, `verify`, `cdk`. `verify`는 Task 2 이후 CI가 실행하는 단일 진입점이다.
- Produces: 빌드 산출물 `out/index.html`에 `<meta name="build-sha" content="$BUILD_SHA">`. Task 5의 `smoke.sh`가 이 태그로 배포 버전을 확인한다.
- Produces: `out/404.html`. Task 4의 CloudFront 오류 응답이 이 경로를 쓴다.

- [ ] **Step 1: 기본 설정 파일 작성**

`.nvmrc`:
```
24
```

`.gitignore`:
```
node_modules/
.next/
out/
cdk.out/
next-env.d.ts
*.tsbuildinfo
.DS_Store
```

`package.json`:
```json
{
  "name": "rainyforest-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "check:tokens": "tsx scripts/check-tokens.ts",
    "verify": "npm run check:tokens && npm test && npm run build && npm run typecheck",
    "cdk": "cdk"
  }
}
```

`verify`에서 `typecheck`를 `build` 뒤에 두는 이유: `next build`가 `next-env.d.ts`(CSS import 등의 타입 선언)를 생성하기 때문이다. 이 파일은 gitignore 대상이라 CI에는 build 전에 존재하지 않는다.

`check:tokens`는 Task 2에서 스크립트가 생긴다. Task 1에서는 `verify` 대신 개별 스크립트를 실행한다.

- [ ] **Step 2: 의존성 설치**

```bash
npm install next@16 react@19 react-dom@19
npm install -D typescript@~6.0.3 @types/node@24 @types/react@19 @types/react-dom@19 \
  tailwindcss@4 @tailwindcss/postcss@4 vitest@5 tsx@4
```

Expected: `package-lock.json`이 생성되고 오류가 없다. peer dependency 경고가 TypeScript 버전과 관련해 나오면 기록만 해 둔다(Step 7에서 판단).

- [ ] **Step 3: TypeScript·Next·PostCSS·Vitest 설정**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "out", "cdk.out"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
```

`postcss.config.mjs`:
```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'out/**', 'cdk.out/**'],
  },
})
```

- [ ] **Step 4: 토큰과 전역 CSS**

`app/tokens.css`:
```css
/* The only place that defines the look (spec §8.1).
   Neutral placeholders until the design session (stage 6) replaces them. */
@theme {
  --color-bg: #ffffff;
  --color-fg: #1f2328;
  --color-fg-muted: #59636e;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0d1117;
    --color-fg: #e6edf3;
    --color-fg-muted: #9198a1;
  }
}
```

`app/globals.css`:
```css
@import "tailwindcss";
@import "./tokens.css";

body {
  background: var(--color-bg);
  color: var(--color-fg);
}
```

- [ ] **Step 5: 레이아웃과 페이지**

`app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Woorim Shin',
  description: 'Engineer and researcher working on on-device AI systems.',
  other: { 'build-sha': process.env.BUILD_SHA ?? 'dev' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-prose px-6 py-24">
      <h1 className="text-3xl font-semibold">Woorim Shin</h1>
      <p className="mt-4 text-fg-muted">
        This site is being rebuilt. The CV and blog are moving here.
      </p>
    </main>
  )
}
```

`app/not-found.tsx`:
```tsx
export default function NotFound() {
  return (
    <main className="mx-auto max-w-prose px-6 py-24">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-4">
        <a className="underline" href="/">Go to the home page</a>
      </p>
    </main>
  )
}
```

- [ ] **Step 6: 빌드 산출물 확인**

```bash
BUILD_SHA=abc123 npm run build
grep -o 'name="build-sha" content="abc123"' out/index.html
ls out/404.html out/index.html
```

Expected: 빌드가 성공하고, grep이 메타 태그 한 줄을 출력하며, 두 파일이 모두 존재한다.

- [ ] **Step 7: 타입 검사와 테스트 러너 확인**

```bash
npm run typecheck && npm test
```

Expected: 타입 오류가 없다. 테스트 파일이 없으므로 Vitest가 "No test files found"를 출력하고 종료 코드 0으로 끝난다.

`next build`나 `tsc`가 TypeScript 6과 호환되지 않는다는 오류를 내면 `npm install -D typescript@~5.9`로 내리고, Global Constraints의 버전 줄을 고친 뒤 Step 6부터 다시 실행한다.

`next build`가 `tsconfig.json`을 자동으로 수정했다면(예: `jsx` 값) 그 변경을 받아들이고 함께 커밋한다.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js static export skeleton" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 토큰 규칙 검사

**Files:**
- Create: `scripts/check-tokens.ts`
- Test: `scripts/check-tokens.test.ts`

**Interfaces:**
- Consumes: Task 1의 `npm run check:tokens` 스크립트 항목
- Produces: `findViolations(path: string, content: string): Violation[]`, `interface Violation { path: string; line: number; match: string }`, `TOKENS_FILE = 'app/tokens.css'`. CLI는 `app/`과 `components/` 아래 `.css`/`.ts`/`.tsx`/`.mdx` 파일을 검사하고, 위반이 있으면 목록을 출력한 뒤 종료 코드 1로 끝난다.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/check-tokens.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { findViolations, TOKENS_FILE } from './check-tokens'

describe('findViolations', () => {
  it('flags hex colors outside the tokens file', () => {
    expect(findViolations('app/page.tsx', 'color: #1a1a18;')).toEqual([
      { path: 'app/page.tsx', line: 1, match: '#1a1a18' },
    ])
  })

  it('flags px values, including Tailwind arbitrary values', () => {
    const found = findViolations('components/site/card.tsx', '<div className="w-[37px] mt-4" />')
    expect(found.map((v) => v.match)).toEqual(['37px'])
  })

  it('reports the line number of each violation', () => {
    const found = findViolations('app/globals.css', 'body {\n  margin: 0;\n  padding: 12px;\n}')
    expect(found).toEqual([{ path: 'app/globals.css', line: 3, match: '12px' }])
  })

  it('allows anything in the tokens file', () => {
    expect(findViolations(TOKENS_FILE, '--color-bg: #ffffff; --space: 4px;')).toEqual([])
  })

  it('ignores anchors that are not hex colors', () => {
    expect(findViolations('app/page.tsx', '<a href="#main">Skip</a>')).toEqual([])
  })

  it('ignores Tailwind scale classes and var() references', () => {
    expect(findViolations('app/page.tsx', 'className="px-6 py-24 text-fg-muted"')).toEqual([])
    expect(findViolations('app/globals.css', 'color: var(--color-fg);')).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run scripts/check-tokens.test.ts`
Expected: FAIL. `./check-tokens`를 찾을 수 없다는 오류(Failed to resolve import).

- [ ] **Step 3: 구현**

`scripts/check-tokens.ts`:
```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run scripts/check-tokens.test.ts`
Expected: PASS, 6개 테스트.

- [ ] **Step 5: 실제 코드베이스에 CLI 실행**

```bash
npm run check:tokens
```
Expected: `check-tokens: ok`. Task 1 파일에는 `tokens.css` 밖에 hex·px 값이 없다.

규칙이 실제로 막는지 확인:
```bash
echo '.x { padding: 12px; }' >> app/globals.css
npm run check:tokens; echo "exit=$?"
git checkout app/globals.css
```
Expected: `app/globals.css:8  12px  (move this value into app/tokens.css)`와 `exit=1`.

- [ ] **Step 6: 전체 검증 후 Commit**

```bash
npm run verify
git add scripts/check-tokens.ts scripts/check-tokens.test.ts
git commit -m "feat: enforce design tokens as the only source of colors and px values" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: CloudFront viewer-request 함수

**Files:**
- Create: `infra/functions/viewer-request.js`
- Test: `infra/functions/viewer-request.test.ts`

**Interfaces:**
- Produces: `infra/functions/viewer-request.js`. `cloudfront-js-2.0` 런타임용 파일이다. Task 4가 `FunctionCode.fromFile`로 읽고 KVS를 연결한다.
- 동작 규칙(스펙 §7.1), 적용 순서대로:
  1. `Host`가 `www.`로 시작하면 → `https://<apex><uri>`로 301. 쿼리스트링은 버린다.
  2. 확장자가 없는 경로면 → KVS에서 키를 조회한다. 키는 끝 슬래시를 뗀 경로이고, `/`는 그대로 `/`다. 값이 있으면 그 값으로 301.
  3. `/`로 끝나면 `index.html`을, 확장자가 없으면 `/index.html`을 붙인다.
  4. 확장자가 있는 경로(에셋)는 KVS를 조회하지 않고 그대로 통과시킨다.
- KVS 키 형식 계약: 리다이렉트 맵의 키는 **끝 슬래시 없는 경로**다(예: `/old-post`). 이행 4단계의 KVS 갱신 코드가 이 형식을 따른다.

- [ ] **Step 1: 실패하는 테스트 작성**

CloudFront Functions는 `import cf from 'cloudfront'`를 쓰는데, Node에는 이 모듈이 없다. 그래서 테스트는 import 줄을 떼어 내고, 가짜 `cf`를 인자로 넣어 함수 본문을 평가한다.

`infra/functions/viewer-request.test.ts`:
```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const IMPORT_LINE = "import cf from 'cloudfront';"
const raw = readFileSync(new URL('./viewer-request.js', import.meta.url), 'utf8')
if (!raw.includes(IMPORT_LINE)) throw new Error(`viewer-request.js must start with: ${IMPORT_LINE}`)
const source = raw.replace(IMPORT_LINE, '')

type Handler = (event: unknown) => Promise<any>

function load(redirects: Record<string, string> = {}): { handler: Handler; lookups: string[] } {
  const lookups: string[] = []
  const cf = {
    kvs: () => ({
      get: async (key: string) => {
        lookups.push(key)
        if (!(key in redirects)) throw new Error(`key not found: ${key}`)
        return redirects[key]
      },
    }),
  }
  const handler = new Function('cf', `${source}\nreturn handler;`)(cf) as Handler
  return { handler, lookups }
}

function event(uri: string, host = 'example.dev') {
  return { request: { uri, headers: { host: { value: host } }, querystring: {} } }
}

describe('viewer-request', () => {
  it('serves index.html for the root', async () => {
    const { handler } = load()
    expect((await handler(event('/'))).uri).toBe('/index.html')
  })

  it('serves index.html for directory paths with a trailing slash', async () => {
    const { handler } = load()
    expect((await handler(event('/blog/foo/'))).uri).toBe('/blog/foo/index.html')
  })

  it('serves index.html for directory paths without a trailing slash', async () => {
    const { handler } = load()
    expect((await handler(event('/blog/foo'))).uri).toBe('/blog/foo/index.html')
  })

  it('passes asset paths through untouched and skips the KVS lookup', async () => {
    const { handler, lookups } = load({ '/_next/static/app.js': '/elsewhere' })
    expect((await handler(event('/_next/static/app.js'))).uri).toBe('/_next/static/app.js')
    expect(lookups).toEqual([])
  })

  it('redirects www to the apex domain, keeping the path', async () => {
    const { handler } = load()
    expect(await handler(event('/blog/', 'www.example.dev'))).toEqual({
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://example.dev/blog/' } },
    })
  })

  it('redirects paths found in the KVS map, with or without a trailing slash', async () => {
    const { handler, lookups } = load({ '/old-post': '/blog/new-post/' })
    for (const uri of ['/old-post', '/old-post/']) {
      const res = await handler(event(uri))
      expect(res.statusCode).toBe(301)
      expect(res.headers.location.value).toBe('/blog/new-post/')
    }
    expect(lookups).toEqual(['/old-post', '/old-post'])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run infra/functions/viewer-request.test.ts`
Expected: FAIL. `ENOENT: no such file or directory ... viewer-request.js`

- [ ] **Step 3: 구현**

`infra/functions/viewer-request.js`:
```js
import cf from 'cloudfront';

// CloudFront Functions runtime (cloudfront-js-2.0): no npm modules, `handler` must be global.
const redirects = cf.kvs();

async function handler(event) {
  const request = event.request;
  const host = request.headers.host ? request.headers.host.value : '';

  if (host.startsWith('www.')) {
    return movedPermanently(`https://${host.slice(4)}${request.uri}`);
  }

  const lastSegment = request.uri.split('/').pop();
  const isAsset = lastSegment.includes('.');

  if (!isAsset) {
    const key = request.uri.length > 1 ? request.uri.replace(/\/$/, '') : request.uri;
    try {
      return movedPermanently(await redirects.get(key));
    } catch (e) {
      // Not in the redirect map: serve the page.
    }
  }

  if (request.uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!isAsset) {
    request.uri += '/index.html';
  }
  return request;
}

function movedPermanently(location) {
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { location: { value: location } },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run infra/functions/viewer-request.test.ts`
Expected: PASS, 6개 테스트.

- [ ] **Step 5: 전체 검증 후 Commit**

```bash
npm run verify
git add infra/functions/
git commit -m "feat: add CloudFront viewer-request function for redirects and clean URLs" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: CDK 스택

**Files:**
- Create: `infra/lib/site-stack.ts`, `infra/bin/app.ts`, `cdk.json`
- Test: `infra/lib/site-stack.test.ts`

**Interfaces:**
- Consumes: Task 3의 `infra/functions/viewer-request.js`
- Produces: `class SiteStack extends Stack`, props는 `SiteStackProps { siteDomain: string; githubRepo: string; budgetEmail: string; existingOidcProviderArn?: string }`
- Produces: 스택 출력 `BucketName`, `DistributionId`, `DistributionDomainName`, `RedirectsKvsArn`, `DeployRoleArn`. Task 6이 GitHub 변수로 옮기고, Task 5의 워크플로가 사용한다.
- Produces: 배포 역할 권한. 버킷 읽기·쓰기·삭제·목록, 해당 배포에 대한 `cloudfront:CreateInvalidation`/`GetInvalidation`, 해당 KVS에 대한 `cloudfront-keyvaluestore:DescribeKeyValueStore`/`ListKeys`/`UpdateKeys`. KVS 권한은 이행 4단계에서 쓰지만 지금 넣는다. 인프라 변경 횟수를 줄이기 위해서다.

- [ ] **Step 1: CDK 의존성 설치**

```bash
npm install -D aws-cdk-lib@2 constructs@10 aws-cdk@2
```

- [ ] **Step 2: 실패하는 테스트 작성**

`infra/lib/site-stack.test.ts`:
```ts
import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { describe, expect, it } from 'vitest'
import { SiteStack, type SiteStackProps } from './site-stack'

function synth(overrides: Partial<SiteStackProps> = {}): Template {
  const app = new App()
  const stack = new SiteStack(app, 'Test', {
    env: { account: '123456789012', region: 'us-east-1' },
    siteDomain: 'example.dev',
    githubRepo: 'RainyForest23/rainyforest-web',
    budgetEmail: 'alerts@example.dev',
    ...overrides,
  })
  return Template.fromStack(stack)
}

const template = synth()

describe('SiteStack', () => {
  it('blocks all public access to the bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    })
  })

  it('lets only CloudFront read the bucket, through OAC', () => {
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1)
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 's3:GetObject',
          }),
        ]),
      },
    })
  })

  it('issues one DNS-validated certificate for apex and www', () => {
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'example.dev',
      SubjectAlternativeNames: ['www.example.dev'],
      ValidationMethod: 'DNS',
    })
  })

  it('serves apex and www over TLS 1.2+ and redirects http to https', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['example.dev', 'www.example.dev'],
        ViewerCertificate: Match.objectLike({
          MinimumProtocolVersion: 'TLSv1.2_2021',
          SslSupportMethod: 'sni-only',
        }),
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
          FunctionAssociations: [Match.objectLike({ EventType: 'viewer-request' })],
        }),
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 403, ResponseCode: 404, ResponsePagePath: '/404.html' }),
          Match.objectLike({ ErrorCode: 404, ResponseCode: 404, ResponsePagePath: '/404.html' }),
        ]),
      }),
    })
  })

  it('runs the viewer-request function on JS 2.0 with the redirect store attached', () => {
    template.resourceCountIs('AWS::CloudFront::KeyValueStore', 1)
    template.hasResourceProperties('AWS::CloudFront::Function', {
      FunctionConfig: Match.objectLike({
        Runtime: 'cloudfront-js-2.0',
        KeyValueStoreAssociations: [Match.objectLike({ KeyValueStoreARN: Match.anyValue() })],
      }),
    })
  })

  it('lets GitHub Actions assume the deploy role only from main of this repo', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                'token.actions.githubusercontent.com:sub':
                  'repo:RainyForest23/rainyforest-web:ref:refs/heads/main',
              },
            },
          }),
        ],
      },
    })
  })

  it('creates the GitHub OIDC provider, or reuses an existing one', () => {
    template.resourceCountIs('AWS::IAM::OIDCProvider', 1)
    const reused = synth({
      existingOidcProviderArn:
        'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
    })
    reused.resourceCountIs('AWS::IAM::OIDCProvider', 0)
  })

  it('alerts by email when monthly cost passes $5', () => {
    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({
        BudgetType: 'COST',
        TimeUnit: 'MONTHLY',
        BudgetLimit: { Amount: 5, Unit: 'USD' },
      }),
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Subscribers: [{ SubscriptionType: 'EMAIL', Address: 'alerts@example.dev' }],
        }),
      ]),
    })
  })

  it('contains no Lambda functions, including hidden custom resources', () => {
    template.resourceCountIs('AWS::Lambda::Function', 0)
  })

  it('exports the values the deploy workflow needs', () => {
    const outputs = Object.keys(template.toJSON().Outputs ?? {})
    expect(outputs).toEqual(
      expect.arrayContaining([
        'BucketName',
        'DistributionId',
        'DistributionDomainName',
        'RedirectsKvsArn',
        'DeployRoleArn',
      ]),
    )
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run infra/lib/site-stack.test.ts`
Expected: FAIL. `./site-stack`을 찾을 수 없다는 오류(Failed to resolve import).

- [ ] **Step 4: 스택 구현**

`infra/lib/site-stack.ts`:
```ts
import { fileURLToPath } from 'node:url'
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as budgets from 'aws-cdk-lib/aws-budgets'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'

export interface SiteStackProps extends StackProps {
  /** Apex domain, e.g. "example.dev". www is served and redirected to it. */
  siteDomain: string
  /** "owner/name" of the repository allowed to deploy. */
  githubRepo: string
  /** Receives budget alerts. Injected at deploy time; never committed. */
  budgetEmail: string
  /** The GitHub OIDC provider is one per account; pass its ARN if it already exists. */
  existingOidcProviderArn?: string
}

const GITHUB_OIDC_HOST = 'token.actions.githubusercontent.com'

export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props)
    const { siteDomain, githubRepo, budgetEmail } = props
    const wwwDomain = `www.${siteDomain}`

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })

    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: siteDomain,
      subjectAlternativeNames: [wwwDomain],
      validation: acm.CertificateValidation.fromDns(),
    })

    const redirects = new cloudfront.KeyValueStore(this, 'Redirects')

    const viewerRequest = new cloudfront.Function(this, 'ViewerRequest', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromFile({
        filePath: fileURLToPath(new URL('../functions/viewer-request.js', import.meta.url)),
      }),
      keyValueStore: redirects,
    })

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: [siteDomain, wwwDomain],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          { function: viewerRequest, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      // Without s3:ListBucket, S3 answers 403 for missing keys; show the 404 page for both.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 404,
        responsePagePath: '/404.html',
        ttl: Duration.minutes(5),
      })),
    })

    const oidcProviderArn =
      props.existingOidcProviderArn ??
      new iam.CfnOIDCProvider(this, 'GithubOidcProvider', {
        url: `https://${GITHUB_OIDC_HOST}`,
        clientIdList: ['sts.amazonaws.com'],
      }).attrArn

    const deployRole = new iam.Role(this, 'GithubDeployRole', {
      description: `Content deploys from ${githubRepo}@main`,
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.FederatedPrincipal(
        oidcProviderArn,
        {
          StringEquals: {
            [`${GITHUB_OIDC_HOST}:aud`]: 'sts.amazonaws.com',
            [`${GITHUB_OIDC_HOST}:sub`]: `repo:${githubRepo}:ref:refs/heads/main`,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    })
    bucket.grantReadWrite(deployRole)
    bucket.grantDelete(deployRole)
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
        resources: [distribution.distributionArn],
      }),
    )
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'cloudfront-keyvaluestore:DescribeKeyValueStore',
          'cloudfront-keyvaluestore:ListKeys',
          'cloudfront-keyvaluestore:UpdateKeys',
        ],
        resources: [redirects.keyValueStoreArn],
      }),
    )

    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: 'rainyforest-web-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 5, unit: 'USD' },
      },
      notificationsWithSubscribers: (['ACTUAL', 'FORECASTED'] as const).map((notificationType) => ({
        notification: {
          notificationType,
          comparisonOperator: 'GREATER_THAN',
          threshold: 100,
          thresholdType: 'PERCENTAGE',
        },
        subscribers: [{ subscriptionType: 'EMAIL', address: budgetEmail }],
      })),
    })

    new CfnOutput(this, 'BucketName', { value: bucket.bucketName })
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
    new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName })
    new CfnOutput(this, 'RedirectsKvsArn', { value: redirects.keyValueStoreArn })
    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn })
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run infra/lib/site-stack.test.ts`
Expected: PASS, 10개 테스트.

실패할 때 먼저 확인할 것:
- 버킷 정책 `Action`이 배열(`['s3:GetObject']`)로 나오면, 테스트 기대값을 합성 결과에 맞춰 배열로 고친다. 이건 CDK 표현 방식 차이일 뿐 보안 요구가 바뀐 게 아니다.
- `AWS::Lambda::Function`이 1개 이상 나오면, 커스텀 리소스를 만드는 구성이 섞인 것이다. `npx cdk synth`로 템플릿을 보고 어떤 construct가 만들었는지 찾아 제거한다. 테스트 기대값은 절대 바꾸지 않는다.

- [ ] **Step 6: CDK 앱 진입점**

`infra/bin/app.ts`:
```ts
import { App } from 'aws-cdk-lib'
import { SiteStack } from '../lib/site-stack'

const app = new App()

const siteDomain: string | undefined = app.node.tryGetContext('siteDomain')
if (!siteDomain) throw new Error('Set "siteDomain" in cdk.json context (see README: first deploy).')

const budgetEmail = process.env.BUDGET_EMAIL
if (!budgetEmail) throw new Error('Set BUDGET_EMAIL in the environment when running cdk.')

new SiteStack(app, 'RainyforestWeb', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  siteDomain,
  githubRepo: 'RainyForest23/rainyforest-web',
  budgetEmail,
  existingOidcProviderArn: app.node.tryGetContext('existingOidcProviderArn'),
})
```

`cdk.json` (도메인은 Task 6에서 추가한다):
```json
{
  "app": "npx tsx infra/bin/app.ts",
  "context": {}
}
```

- [ ] **Step 7: 설정 누락 시 친절하게 실패하는지 확인**

```bash
npx cdk synth 2>&1 | grep -F 'Set "siteDomain" in cdk.json context'
```
Expected: 오류 메시지 한 줄이 출력된다. 이 명령은 AWS 자격증명 없이도 동작한다.

- [ ] **Step 8: 전체 검증 후 Commit**

```bash
npm run verify
git add infra/lib/ infra/bin/ cdk.json package.json package-lock.json
git commit -m "feat: add CDK stack for S3, CloudFront, OIDC deploy role and budget alert" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: CI·배포 워크플로와 스크립트

**Files:**
- Create: `scripts/deploy.sh`, `scripts/smoke.sh`
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm run verify`(Task 1·2), `out/`(Task 1), 빌드 메타 태그 `build-sha`(Task 1), 스택 출력(Task 4)
- Produces: GitHub 저장소 변수(Variables) 이름 `AWS_DEPLOY_ROLE_ARN`, `SITE_BUCKET`, `DISTRIBUTION_ID`, `SITE_DOMAIN`. Task 6이 값을 채운다.
- Produces: `repository_dispatch` 이벤트 타입 `vault-updated`. 이행 4단계에서 볼트 레포가 이 타입으로 사이트 배포를 트리거한다.

- [ ] **Step 1: 배포 스크립트**

업로드 순서가 핵심이다. CloudFront에 캐시된 옛 HTML이 옛 에셋을 참조하는 동안에는 그 에셋을 지우면 안 된다.

`scripts/deploy.sh`:
```bash
#!/usr/bin/env bash
# Upload the static export so that no served HTML ever points at a missing asset.
set -euo pipefail
: "${SITE_BUCKET:?SITE_BUCKET is required}"
: "${DISTRIBUTION_ID:?DISTRIBUTION_ID is required}"
OUT_DIR="${OUT_DIR:-out}"
IMMUTABLE="public, max-age=31536000, immutable"
REVALIDATE="public, max-age=0, s-maxage=31536000, must-revalidate"

# 1. New hashed assets first, without deleting: cached HTML may still use the old ones.
aws s3 sync "$OUT_DIR/_next/static" "s3://$SITE_BUCKET/_next/static" --cache-control "$IMMUTABLE"

# 2. Pages and other files; remove pages that no longer exist.
aws s3 sync "$OUT_DIR" "s3://$SITE_BUCKET" --delete \
  --exclude "_next/static/*" --cache-control "$REVALIDATE"

# 3. Drop cached HTML and wait until the edge serves the new build.
invalidation_id=$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths '/*' --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed \
  --distribution-id "$DISTRIBUTION_ID" --id "$invalidation_id"

# 4. No cached page references old assets any more; prune them.
aws s3 sync "$OUT_DIR/_next/static" "s3://$SITE_BUCKET/_next/static" --delete \
  --cache-control "$IMMUTABLE"

echo "deploy: ok (invalidation $invalidation_id)"
```

- [ ] **Step 2: 스모크 스크립트**

`scripts/smoke.sh`:
```bash
#!/usr/bin/env bash
# Checks the live domain after a deploy. Fails loudly on the first broken expectation.
set -euo pipefail
: "${SITE_DOMAIN:?SITE_DOMAIN is required}"
: "${EXPECTED_SHA:?EXPECTED_SHA is required}"

fail() { echo "smoke: $*" >&2; exit 1; }
status() { curl -s -o /dev/null -w '%{http_code}' "$1"; }

curl -fsS "https://$SITE_DOMAIN/" | grep -qF "content=\"$EXPECTED_SHA\"" \
  || fail "home page is not build $EXPECTED_SHA"

[ "$(status "https://$SITE_DOMAIN/definitely-missing-page/")" = "404" ] \
  || fail "a missing page did not return 404"

[ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://www.$SITE_DOMAIN/")" \
  = "301 https://$SITE_DOMAIN/" ] || fail "www did not 301 to the apex"

[ "$(status "http://$SITE_DOMAIN/")" = "301" ] || fail "http did not redirect to https"

echo "smoke: ok ($SITE_DOMAIN @ $EXPECTED_SHA)"
```

- [ ] **Step 3: 스크립트 문법과 필수 변수 검사 확인**

```bash
chmod +x scripts/deploy.sh scripts/smoke.sh
bash -n scripts/deploy.sh && bash -n scripts/smoke.sh && echo syntax-ok
env -u SITE_BUCKET ./scripts/deploy.sh; echo "exit=$?"
```
Expected: `syntax-ok`가 출력되고, 두 번째 명령은 `SITE_BUCKET is required`와 `exit=1`을 출력한다. AWS를 전혀 호출하지 않는다.

- [ ] **Step 4: CI 워크플로**

`.github/workflows/ci.yml`:
```yaml
name: ci

on:
  pull_request:
  workflow_call:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run verify
```

- [ ] **Step 5: 배포 워크플로**

`.github/workflows/deploy.yml`:
```yaml
name: deploy

on:
  push:
    branches: [main]
  repository_dispatch:
    types: [vault-updated]
  workflow_dispatch:

# Never run two deploys at once; queue instead of cancelling a half-finished upload.
concurrency:
  group: deploy
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  verify:
    uses: ./.github/workflows/ci.yml

  deploy:
    needs: verify
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          BUILD_SHA: ${{ github.sha }}
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: us-east-1
      - run: ./scripts/deploy.sh
        env:
          SITE_BUCKET: ${{ vars.SITE_BUCKET }}
          DISTRIBUTION_ID: ${{ vars.DISTRIBUTION_ID }}
      - run: ./scripts/smoke.sh
        env:
          SITE_DOMAIN: ${{ vars.SITE_DOMAIN }}
          EXPECTED_SHA: ${{ github.sha }}
```

- [ ] **Step 6: 워크플로 문법 확인**

```bash
npx --yes @action-validator/cli .github/workflows/ci.yml
npx --yes @action-validator/cli .github/workflows/deploy.yml
```
Expected: 두 파일 모두 오류 없이 종료한다(종료 코드 0).

- [ ] **Step 7: Commit (push는 Task 6에서)**

main에 push하면 배포 워크플로가 실행되는데, 아직 AWS 변수가 없어서 deploy 잡이 실패한다. 그래서 커밋만 하고 push는 Task 6에서 한다.

```bash
npm run verify
git add scripts/deploy.sh scripts/smoke.sh .github/
git commit -m "ci: verify on PRs, deploy to S3/CloudFront on main with post-deploy smoke test" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: 첫 배포와 운영 런북 (사용자 수행)

> **2026-09-20 보류.** 사용자가 도메인 구매를 최후순위로 미뤘다. Step 1(README)은 완료했고, Step 2부터는 도메인을 구매한 뒤에 실행한다. 그때까지 2단계 이후 작업을 로컬에서 진행한다.

AWS SSO, 도메인, Cloudflare 계정이 필요하므로 사용자가 직접 수행한다. README 작성(Step 1)만 Claude가 도울 수 있다.

**Files:**
- Create: `README.md`
- Modify: `cdk.json` (`siteDomain`, 필요하면 `existingOidcProviderArn`)

**Interfaces:**
- Consumes: Task 4 스택 출력, Task 5 변수 이름
- Produces: 실제 도메인에서 동작하는 사이트. 이행 1단계 완료 기준(스펙 §10)이다.

- [ ] **Step 1: README 작성**

`README.md`:
````markdown
# rainyforest-web

Personal site: CV, portfolio and a blog published from an Obsidian vault.
Design and decisions: `docs/superpowers/specs/2026-09-19-personal-site-design.md`.

## Develop

```bash
npm ci
npm run dev       # http://localhost:3000
npm run verify    # everything CI runs
```

## How it ships

- `main` push → GitHub Actions verifies, builds a static export, uploads it to S3,
  invalidates CloudFront and runs `scripts/smoke.sh` against the live domain.
- AWS access comes from an OIDC role limited to this repo's `main` branch.
  No long-lived AWS keys exist in GitHub.
- Infrastructure (`infra/`) is deployed by hand with `npx cdk deploy`. It changes rarely.

## Runbook

### DNS records (Cloudflare, all "DNS only")

| Name | Type | Target |
|---|---|---|
| apex | CNAME | CloudFront `DistributionDomainName` output |
| `www` | CNAME | same as apex. The redirect to apex happens in CloudFront. |
| `_<token>` (two records) | CNAME | ACM validation values |

**Never delete the ACM validation records.** ACM renews the certificate
through them; without them the site stops serving HTTPS when the certificate expires.

Keep the proxy (orange cloud) off: Cloudflare Redirect Rules and caching are not used,
and a second CDN layer would need its own cache purge on every deploy.

### Deploy infrastructure

```bash
aws sso login
BUDGET_EMAIL=<your email> npx cdk deploy
```

### Roll back content

Open an earlier successful `deploy` run in Actions and choose "Re-run all jobs"
(it rebuilds that run's commit), or `git revert` the bad commit and push.
````

```bash
git add README.md
git commit -m "docs: add README with DNS and deploy runbook" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 2: AWS 로그인과 계정 상태 확인**

```bash
aws sso login
aws sts get-caller-identity --query Account --output text
aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[].Arn" --output text
aws cloudformation describe-stacks --stack-name CDKToolkit --region us-east-1 \
  --query 'Stacks[0].StackStatus' --output text
```

판단:
- OIDC 목록에 `token.actions.githubusercontent.com`로 끝나는 ARN이 있으면, 그 ARN을 `cdk.json`의 `context.existingOidcProviderArn`에 넣는다. 계정당 하나만 만들 수 있다.
- `CDKToolkit` 조회가 `does not exist` 오류를 내면 아직 bootstrap하지 않은 것이다. Step 4에서 bootstrap한다.

- [ ] **Step 3: 도메인 설정**

`cdk.json`의 `context`에 구매한 apex 도메인을 넣는다(예시는 `rainyforest.dev`이며, 실제로 구매한 이름으로 바꾼다):
```json
{
  "app": "npx tsx infra/bin/app.ts",
  "context": {
    "siteDomain": "rainyforest.dev"
  }
}
```

```bash
BUDGET_EMAIL=you@example.com npx cdk synth > /dev/null && echo synth-ok
```
Expected: `synth-ok`

- [ ] **Step 4: bootstrap과 배포**

```bash
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
BUDGET_EMAIL=<알림 받을 이메일> npx cdk deploy
```

배포는 인증서 단계(`AWS::CertificateManager::Certificate`)에서 **DNS 검증을 기다리며 멈춘다**. 정상이다. 다른 터미널에서 검증 레코드를 확인한다:

```bash
arn=$(aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='rainyforest.dev'].CertificateArn" --output text)
aws acm describe-certificate --region us-east-1 --certificate-arn "$arn" \
  --query 'Certificate.DomainValidationOptions[].ResourceRecord' --output table
```

출력된 CNAME 레코드(apex용, www용)를 Cloudflare DNS에 **DNS only**로 추가한다. 몇 분 안에 검증이 끝나고 배포가 이어진다. CloudFront 생성까지 포함해 총 5~15분 정도 걸린다.

- [ ] **Step 5: 사이트 DNS 레코드 추가**

```bash
aws cloudformation describe-stacks --stack-name RainyforestWeb --region us-east-1 \
  --query 'Stacks[0].Outputs' --output table
```

Cloudflare에 추가한다(둘 다 DNS only):
- apex: `CNAME` → `DistributionDomainName` 값
- `www`: `CNAME` → 같은 값

- [ ] **Step 6: GitHub 변수 설정**

```bash
out() { aws cloudformation describe-stacks --stack-name RainyforestWeb --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
gh variable set AWS_DEPLOY_ROLE_ARN --body "$(out DeployRoleArn)"
gh variable set SITE_BUCKET --body "$(out BucketName)"
gh variable set DISTRIBUTION_ID --body "$(out DistributionId)"
gh variable set SITE_DOMAIN --body "rainyforest.dev"
gh variable list
```
Expected: 네 변수가 목록에 나온다. 역할 ARN은 비밀이 아니다. 신뢰 정책이 이 레포 main에서만 역할을 쓸 수 있게 막는다.

- [ ] **Step 7: push로 첫 자동 배포**

```bash
git add cdk.json
git commit -m "chore: set site domain"
git push origin main
gh run watch --exit-status $(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```
Expected: `verify`와 `deploy` 잡이 모두 성공하고, 로그 마지막에 `smoke: ok (rainyforest.dev @ <sha>)`가 출력된다.

실패할 때 먼저 확인할 것:
- `Not authorized to perform sts:AssumeRoleWithWebIdentity`: `deploy.yml`의 `id-token: write` 권한과, 푸시한 브랜치가 `main`인지 확인한다.
- 스모크의 `home page is not build`: DNS 전파 중일 수 있다. `dig +short rainyforest.dev`가 CloudFront 주소를 가리키는지 확인한 뒤 워크플로를 다시 실행한다.

- [ ] **Step 8: 완료 기준 확인 (스펙 §10 1단계)**

브라우저로 `https://<도메인>`에 접속해 임시 홈이 보이는지 확인한다. `https://www.<도메인>/cv/`는 `https://<도메인>/cv/`로 이동한 뒤 404 페이지를 보여야 한다(아직 CV 페이지가 없다).

비용 안전장치 확인: AWS 콘솔 → Billing → Budgets에서 `rainyforest-web-monthly`가 $5로 보인다.

---

## 이후 계획 (별도 문서로 작성)

각 단계는 앞 단계를 구현하며 배운 점을 반영해 그때 계획한다.

| 계획 | 스펙 단계 | 이 계획에서 미룬 항목 |
|---|---|---|
| Stage 2: CV·프로젝트 | 2 | shadcn 초기화, JSON Resume 스키마 검증 |
| Stage 3: 레거시 블로그 | 3 | lychee 내부 링크 검사 |
| Stage 4: 볼트 파이프라인 | 4 | CI의 볼트 clone(deploy key), KVS 리다이렉트 맵 갱신, 볼트 레포의 `vault-updated` dispatch, Playwright(mermaid 렌더링·E2E 스모크) |
| Stage 5: 조회수 API | 5 | Lambda·DynamoDB·로그 보존 14일과 해당 CDK 테스트, "Lambda 0개" 테스트를 "정확히 1개"로 변경, PR의 `cdk diff` 자동 코멘트 |
| 디자인 세션 → Stage 6 | 6 | `frontend-design` 스킬 설치 후 brainstorming부터 |
| Stage 7: 전환 | 7 | github.io 리다이렉트 스텁, 기존 레포 아카이브 |
