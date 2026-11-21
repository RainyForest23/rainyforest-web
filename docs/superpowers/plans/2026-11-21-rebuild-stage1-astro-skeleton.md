# 재설계 1단계: Astro 뼈대 + CV + 옛 글 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **`[직접]` 작업은 에이전트가 구현하지 않는다.** 에이전트는 그 작업의 개념 노트·뼈대·실패 테스트만 만들고 멈춘 뒤, 사이트 주인이 구현하면 리뷰한다 (spec §11).

**Goal:** Next.js 코드를 걷어내고 Astro 7로 정적 사이트 뼈대를 세워, `/cv`와 옛 글 18편이 영어(`/`)·한국어(`/ko/`) 경로로 열리고 모든 검사가 CI에서 통과하게 한다.

**Architecture:** Astro 정적 출력(`dist/`)을 지금처럼 Cloudflare Workers 정적 에셋으로 내보낸다. 페이지 본문은 `src/views/`에 언어(`locale`)를 받는 컴포넌트로 한 번만 쓰고, `src/pages/`와 `src/pages/ko/`의 얇은 라우트 파일이 그것을 부른다. 콘텐츠는 레포 루트 `content/`에 그대로 두고 Astro content collection(`glob` 로더 + Zod 스키마)으로 읽는다.

**Tech Stack:** Astro 7.4, @astrojs/mdx 8, @astrojs/sitemap 3, @astrojs/markdown-remark 7 (unified 처리기), remark-gfm, remark-math, rehype-katex, Zod 4 (`astro/zod`), TypeScript ~6.0.3, Vitest 5, tsx, wrangler 4. React는 3단계(타임라인)에서 추가한다.

**Spec:** `docs/superpowers/specs/2026-11-21-site-rebuild-design.md` (§4.4 가져갈 것, §5 경로, §10 언어, §11 학습 방식, §12 1단계, §3 공개 범위)

## Global Constraints

- Node: `.nvmrc`의 24 유지 (Astro 7은 22.12.0 이상 필요). 패키지 관리자 npm (pnpm은 corepack 문제로 쓰지 않음).
- TypeScript `~6.0.3` 고정 (`@astrojs/check`의 peer 범위 `^5 || ^6`).
- **Astro 7 API는 학습 데이터와 다를 수 있다.** Astro 코드를 쓰기 전에 해당 문서(docs.astro.build의 content collections, i18n, configuration reference, upgrade to v7)를 확인한다. 특히: 설정 파일은 `src/content.config.ts`, `z`는 `astro/zod`에서, `render(entry)`는 `astro:content`에서, Markdown 플러그인은 `@astrojs/markdown-remark`의 `unified()` 처리기로.
- 영어가 기본(루트), 한국어는 `/ko/`. `trailingSlash: 'always'`, `build.format: 'directory'`. 모든 내부 링크는 `/`로 끝난다.
- 색과 px 값은 `src/styles/tokens.css`에만. 다른 파일(`.astro`, `.css`, `.ts`, `.mdx`)에 쓰면 `check:tokens`가 실패한다.
- 학점(GPA)은 어디에도 공개하지 않는다. 이메일은 공개한다.
- 확인된 수치만: LLM 벤치마크는 3종.
- Tailwind와 shadcn/ui는 쓰지 않는다. 스타일은 Astro 컴포넌트의 `<style>`과 `tokens.css`의 CSS 변수로. *(이 계획의 결정: spec이 만드는 사람에게 맡긴 부분이며, 의존성과 설정이 가장 적다.)*
- 한국어 문장은 쉬운 말로 쓴다.
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 와 `Claude-Session: https://claude.ai/code/session_016oARMPvxh4FsgwiuzuZKrG` (Claude가 만든 커밋만).
- 작업 브랜치: `rebuild/astro`. PR은 merge commit으로 합친다 (squash 금지, spec §8.2).

## Review Focus

1. **한글·퍼센트 인코딩된 경로:** `redirects.json`의 대상 중 일부는 `/blog/`처럼 목록으로 가고, 키는 `%EC%...` 형태다. 대상 경로가 빌드 결과에 실제로 있는지 디코딩해서 확인해야 한다. → Task 7 `brokenRedirects` 테스트.
2. **언어와 원문이 다른 글:** 한국어 원문 글을 영어 경로(`/blog/x/`)로 열면 영어 요약과 "Korean only" 안내가 보이고 본문 `lang="ko"`가 붙어야 한다. 반대로 `/ko/blog/x/`에서 영어 원문 글은 한국어 안내가 붙는다. → Task 6 dist 검사.
3. **학점 노출:** `resume.json`에서 지워도 다른 경로(예전 PDF 등)로 새지 않아야 한다. → Task 5 스키마가 `score`를 거부, Task 7이 `dist/` 전체에서 `GPA`와 `[removed]`을 찾으면 실패.
4. **YAML 날짜:** 따옴표 없는 `date: 2026-04-14`는 Date 객체가 되어 시간대 때문에 하루 밀릴 수 있다. → Task 6 스키마 테스트.
5. **언어 전환 링크:** 모든 페이지(404 제외)의 언어 전환 링크와 `hreflang` 대체 링크가 실제로 있는 페이지를 가리켜야 한다. → Task 3 단위 테스트 + Task 7 `missingAlternates`.

---

## 파일 구조

```
astro.config.mjs              Astro 설정 (site, i18n, trailingSlash, markdown 처리기, 통합)
src/
  content.config.ts           collections: legacy (resume는 JSON이라 직접 읽음)
  styles/tokens.css           색·글꼴·간격 변수 (유일한 값 정의 장소)
  styles/prose.css            글 본문 스타일 (변수만 사용)
  i18n/ui.ts                  화면 문구 사전 en/ko + t()
  i18n/paths.ts               localePath, splitLocale, alternates
  layouts/Base.astro          <html lang>, head(hreflang, build meta), 헤더(메뉴+언어 전환)
  views/Home.astro            임시 첫 화면 (3단계에서 타임라인으로 교체)
  views/Cv.astro              CV 본문
  views/BlogIndex.astro       글 목록
  views/Post.astro            글 본문 + 언어 안내
  views/Tag.astro             태그별 글 목록
  pages/                      얇은 라우트: index, cv/, blog/, blog/[slug], blog/tags/[tag], 404, feed.xml.ts
  pages/ko/                   같은 라우트의 한국어판 (404, feed 제외)
  lib/format.ts               [직접] formatDate, formatPeriod
  lib/cv/schema.ts            resume.json Zod 스키마
  lib/cv/resume.ts            loadResume
  lib/content/legacy.ts       legacy frontmatter Zod 스키마 + sortPosts, tagIndex
  lib/feed.ts                 buildRss
scripts/
  check-tokens.ts             (옮김) src/ 대상, .astro 포함
  check-links.ts              (옮김) dist/ 대상
  check-dist.ts               (새로) 필수 페이지, 리다이렉트 대상, 금지 문자열, hreflang
docs/learning/                개념 노트와 "왜 이렇게 했나" 노트
```

테스트 파일은 대상 옆에 `*.test.ts`로 둔다 (기존 레포 방식).

---

### Task 1 [Claude]: Next.js 걷어내고 Astro 빌드 세우기

**배울 개념:** 정적 사이트 생성기가 하는 일 (빌드 때 HTML을 미리 만들어 두는 것).

**Files:**
- Delete: `app/`, `components/`, `lib/`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `components.json`, `infra/`, `cdk.json`, `cdk.out/`, `out/`, `tsconfig.tsbuildinfo`, `AGENTS.md`, `vitest.config.ts`(새로 씀)
- Create: `astro.config.mjs`, `tsconfig.json`(덮어씀), `vitest.config.ts`, `src/styles/tokens.css`, `src/styles/prose.css`, `src/layouts/Base.astro`, `src/views/Home.astro`, `src/pages/index.astro`, `src/pages/404.astro`, `CLAUDE.md`(덮어씀), `docs/learning/stage1-why.md`
- Modify: `package.json`, `wrangler.jsonc`, `public/_headers`, `.gitignore`, `README.md`

**Interfaces:**
- Produces: `Base.astro` props `{ title: string; description?: string; locale: Locale; path: string }` (`Locale`은 Task 3에서 정의. 이 작업에서는 `locale: 'en' | 'ko'`로 받고 Task 3에서 타입을 바꾼다). `npm run build` → `dist/`.

- [ ] **Step 1: 지울 파일을 지우고 의존성을 다시 잡는다**

`package.json`의 dependencies/devDependencies를 아래로 바꾼다 (버전은 설치 시점의 최신 패치를 허용하는 `^`):
- dependencies: `astro@^7.4.13`, `@astrojs/mdx@^8.1.6`, `@astrojs/sitemap@^3.7.6`, `@astrojs/markdown-remark@^7.3.10`, `remark-gfm`, `remark-math`, `rehype-katex`, `katex`
- devDependencies: `@astrojs/check@^0.9.12`, `typescript@~6.0.3`, `@types/node`, `vitest@^5`, `tsx`, `wrangler@^4`

scripts:
```json
"dev": "astro dev",
"build": "astro build",
"preview": "wrangler dev",
"typecheck": "astro check",
"test": "vitest run --passWithNoTests",
"check:tokens": "tsx scripts/check-tokens.ts",
"check:links": "tsx scripts/check-links.ts",
"check:dist": "tsx scripts/check-dist.ts",
"verify": "npm run check:tokens && npm test && npm run build && npm run check:links && npm run check:dist && npm run typecheck",
"deploy": "wrangler deploy"
```
`check:dist`는 Task 7 전까지 없는 파일이므로, Task 7 전까지 `verify`에서 빼 두고 Task 7에서 넣는다.

Run: `rm -rf node_modules package-lock.json && npm install`
Expected: 설치 성공, peer 경고 없음.

- [ ] **Step 2: Astro 설정과 tsconfig**

`astro.config.mjs`: `site: process.env.SITE_URL ?? 'http://localhost:4321'`, `trailingSlash: 'always'`, `build: { format: 'directory' }`, `i18n: { locales: ['en', 'ko'], defaultLocale: 'en', routing: { prefixDefaultLocale: false } }`, `markdown: { processor: unified({ remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: [rehypeKatex] }) }`, `integrations: [mdx(), sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', ko: 'ko' } } })]`. MDX가 markdown 설정을 물려받는지(`extendMarkdownConfig` 기본값 true) 문서로 확인한다.

`tsconfig.json`: `{ "extends": "astro/tsconfigs/strict", "include": [".astro/types.d.ts", "**/*"], "exclude": ["dist", "node_modules"] }`

`vitest.config.ts`: `getViteConfig`(from `astro/config`)로 감싸 `astro:content` 등 가상 모듈 없이 `src/lib`의 순수 함수를 테스트한다. `test.include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']`.

- [ ] **Step 3: 토큰과 기본 레이아웃**

`src/styles/tokens.css`: 기존 `app/tokens.css`의 값을 `@theme` 대신 `:root`에 그대로 옮긴다 (`--color-bg`, `--color-fg`, `--color-fg-muted`, `--color-line`, `--font-sans`, 다크 모드 블록). 간격과 최대 폭도 변수로 추가: `--space-1: 0.25rem` … `--space-8: 4rem`, `--measure: 42rem`.
`src/styles/prose.css`: 기존 `.prose-body` 규칙을 옮긴다. 색은 변수만.
`Base.astro`: `<html lang={locale}>`, `<meta name="build" content={import.meta.env.BUILD_SHA ?? 'dev'}>` (smoke.sh가 이 값을 확인), `<title>`, description, 본문 `<slot />`. 헤더는 Task 3에서 붙인다.
`Home.astro`: 이름("Woorim Shin")과 "Timeline coming soon" 자리만. (`resume.json` 읽기는 Task 5에서 생긴다.) `index.astro`가 `<Home locale="en" />`.
`404.astro`: 영어 안내 + `/`와 `/ko/` 링크.

- [ ] **Step 4: 호스팅 설정 경로 바꾸기**

`wrangler.jsonc`: `assets.directory`를 `"./dist"`로. 주석의 `next.config.ts` 언급을 `astro.config.mjs`의 `trailingSlash: 'always'`로 고친다.
`public/_headers`: `/_next/static/*`를 `/_astro/*`로.
`.gitignore`: `.next`, `out`, `cdk.out` 줄을 지우고 `dist/`, `.astro/` 추가.
`.github/workflows/deploy.yml`: `repository_dispatch` 트리거 삭제 (볼트 연동 폐기, spec §8.5).

- [ ] **Step 5: 빌드 확인**

Run: `npm run build && ls dist/index.html dist/404.html`
Expected: 두 파일이 있다.

- [ ] **Step 6: 설명 노트와 프로젝트 안내 파일**

`docs/learning/stage1-why.md`에 "Next.js를 왜 걷어냈나, `dist/`가 무엇인가, Workers 정적 에셋이 이 폴더를 어떻게 내보내나"를 10줄 안팎으로 쓴다.
`CLAUDE.md`를 다음 내용으로 바꾼다: 스펙 경로, "Astro 7 문서를 먼저 확인", 공개 범위 규칙(§3) 요약, 토큰 규칙, `[직접]` 작업은 대신 구현하지 말 것.
`README.md`의 Next.js·AWS 설명을 Astro + Cloudflare로 고친다.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "build: replace Next.js with an Astro 7 static skeleton"
```

---

### Task 2 [Claude]: 검사 스크립트 옮기기 (토큰, 링크)

**배울 개념:** 빌드 결과를 검사하는 스크립트가 왜 테스트와 따로 필요한가.

**Files:**
- Create: `scripts/check-tokens.ts`, `scripts/check-tokens.test.ts`, `scripts/check-links.ts`, `scripts/check-links.test.ts` (기존 파일을 git에서 되살려 수정: `git show 1750447:scripts/check-tokens.ts`)
- Modify: `.github/workflows/ci.yml` (변경 없음 확인만)

**Interfaces:**
- Produces: `findViolations(path: string, content: string): Violation[]`, `TOKENS_FILE = 'src/styles/tokens.css'`; `findBrokenLinks(pages: Map<string, string>, files: Set<string>): string[]`

- [ ] **Step 1: 실패하는 테스트 추가**

`check-tokens.test.ts` 기존 테스트에서 `VENDOR_DIR` 관련 테스트를 지우고 추가:
```ts
it('checks .astro files', () => {
  expect(findViolations('src/views/Home.astro', '<style>.a{color:#fff}</style>')).toHaveLength(1)
})
it('allows values in the tokens file', () => {
  expect(findViolations('src/styles/tokens.css', ':root{--x:#fff;--y:4px}')).toEqual([])
})
```
`check-links.test.ts`에 추가:
```ts
it('ignores Astro build assets', () => {
  const pages = new Map([['index.html', '<script src="/_astro/a.js"></script>']])
  expect(findBrokenLinks(pages, new Set(['index.html']))).toEqual([])
})
it('resolves percent-encoded Korean paths', () => {
  const pages = new Map([['index.html', '<a href="/blog/%ED%95%9C/">x</a>']])
  expect(findBrokenLinks(pages, new Set(['index.html', 'blog/한/index.html']))).toEqual([])
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run scripts` / Expected: 새 테스트 FAIL

- [ ] **Step 3: 구현** — `check-tokens.ts`: `ROOTS = ['src']`, `CHECKED = /\.(css|astro|tsx?|mdx)$/`, `VENDOR_DIR` 삭제. `check-links.ts`: 출력 폴더 `dist`, 건너뛸 접두사 `/_astro/`.

- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run check:tokens && npm run build && npm run check:links` / Expected: 모두 ok

- [ ] **Step 5: Commit** — `git commit -m "chore: port token and link checks to the Astro layout"`

---

### Task 3 [Claude]: 영어/한국어 경로와 화면 문구

**배울 개념:** i18n 라우팅, 그리고 "본문은 한 번만 쓰고 라우트는 얇게" 구조.

**Files:**
- Create: `src/i18n/paths.ts`, `src/i18n/paths.test.ts`, `src/i18n/ui.ts`, `src/i18n/ui.test.ts`, `src/pages/ko/index.astro`
- Modify: `src/layouts/Base.astro`

**Interfaces:**
- Produces:
  - `type Locale = 'en' | 'ko'`, `const LOCALES: readonly Locale[]`
  - `localePath(locale: Locale, path: string): string` — `path`는 `/`로 시작하고 끝나는 언어 없는 경로. `en`이면 그대로, `ko`면 `/ko` 접두.
  - `splitLocale(pathname: string): { locale: Locale; path: string }`
  - `alternates(path: string): { locale: Locale; href: string }[]` — 두 언어 모두
  - `t(locale: Locale, key: UiKey): string`, `type UiKey` = 사전의 키 유니언
  - `Base.astro` 헤더: 메뉴(CV, Blog) + 언어 전환 링크, `<head>`에 `<link rel="alternate" hreflang>` 두 개와 `x-default`(영어)

- [ ] **Step 1: 실패하는 테스트**

```ts
// paths.test.ts
expect(localePath('en', '/blog/')).toBe('/blog/')
expect(localePath('ko', '/blog/')).toBe('/ko/blog/')
expect(localePath('ko', '/')).toBe('/ko/')
expect(splitLocale('/ko/blog/x/')).toEqual({ locale: 'ko', path: '/blog/x/' })
expect(splitLocale('/blog/x/')).toEqual({ locale: 'en', path: '/blog/x/' })
expect(splitLocale('/korea-notes/')).toEqual({ locale: 'en', path: '/korea-notes/' }) // 'ko'로 시작하는 다른 경로
expect(() => localePath('en', 'blog')).toThrow()                                     // 슬래시 규칙 위반
expect(alternates('/cv/')).toEqual([{ locale: 'en', href: '/cv/' }, { locale: 'ko', href: '/ko/cv/' }])
// ui.test.ts
it('has every key in both languages', () => {
  expect(Object.keys(ui.ko).sort()).toEqual(Object.keys(ui.en).sort())
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/i18n` / Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현** — 사전 키(처음 목록): `nav.cv`, `nav.blog`, `lang.switch`(en: "한국어", ko: "English"), `cv.download`, `cv.education`, `cv.experience`, `cv.publications`, `cv.talks`, `cv.awards`, `cv.skills`, `cv.languages`, `cv.contentInEnglish`(ko: "CV 내용은 영어로 되어 있습니다."), `blog.title`, `blog.tags`, `post.koreanOnly`(en: "This post is written in Korean. Summary in English:"), `post.englishOnly`(ko: "이 글은 영어로만 있습니다."), `post.updated`, `notFound.title`. `Base.astro`는 `Astro.url.pathname`을 `splitLocale`로 나눠 언어 전환 링크와 hreflang을 만든다. `src/pages/ko/index.astro`는 `<Home locale="ko" />`.

- [ ] **Step 4: 통과 확인** — Run: `npm test && npm run build && ls dist/ko/index.html` / Expected: PASS, 파일 있음

- [ ] **Step 5: 설명 노트** — `docs/learning/stage1-why.md`에 "views와 pages를 나눈 이유" 단락 추가.

- [ ] **Step 6: Commit** — `git commit -m "feat: en/ko routing, UI dictionary and language switch"`

---

### Task 4 [직접]: TypeScript 첫 연습 — 날짜 표시 함수

**배울 개념:** TypeScript의 타입(유니언 타입, 선택 필드 `?`), 문자열 다루기, 테스트 주도 개발 흐름(빨강 → 초록).

이 작업은 사이트 주인이 구현한다. 에이전트는 Step 1~3만 하고 멈춘다.

**Files:**
- Create: `docs/learning/01-typescript-basics.md` (Claude), `src/lib/format.ts` (뼈대: Claude, 본문: 사이트 주인), `src/lib/format.test.ts` (Claude)

**Interfaces:**
- Produces (Task 5·6과 이후 단계의 타임라인이 씀):
  ```ts
  export type Locale = 'en' | 'ko'               // src/i18n/paths.ts에서 import
  export interface Period { start: string; end?: string; approximate?: boolean }
  export function formatDate(iso: string, locale: Locale): string      // 'YYYY-MM-DD'
  export function formatPeriod(period: Period, locale: Locale): string // 'YYYY' | 'YYYY-MM'
  ```

- [ ] **Step 1 (Claude): 개념 노트** — `01-typescript-basics.md`: 타입이 무엇이고 왜 쓰나, `interface`와 `?`, 유니언 타입 `'en' | 'ko'`, `split`/`map(Number)`, 그리고 `new Date('2026-05-06')`가 UTC라서 날짜가 하루 밀릴 수 있는 문제(그래서 직접 나눠 읽는다). 한 화면 분량.

- [ ] **Step 2 (Claude): 뼈대** — `format.ts`에 위 시그니처, 영어 월 이름 배열 `MONTHS`, 각 함수 위에 할 일 주석, 본문은 `throw new Error('TODO')`.

- [ ] **Step 3 (Claude): 실패하는 테스트**

```ts
describe('formatDate', () => {
  it('en', () => expect(formatDate('2026-05-06', 'en')).toBe('May 6, 2026'))
  it('ko', () => expect(formatDate('2026-05-06', 'ko')).toBe('2026년 5월 6일'))
})
describe('formatPeriod', () => {
  it('month range', () => expect(formatPeriod({ start: '2025-06', end: '2026-02' }, 'en')).toBe('Jun 2025 – Feb 2026'))
  it('year range', () => expect(formatPeriod({ start: '2023', end: '2025' }, 'en')).toBe('2023 – 2025'))
  it('ongoing', () => expect(formatPeriod({ start: '2026-06' }, 'en')).toBe('Jun 2026 – Present'))
  it('ongoing ko', () => expect(formatPeriod({ start: '2026-06' }, 'ko')).toBe('2026년 6월 – 현재'))
  it('same start and end', () => expect(formatPeriod({ start: '2025', end: '2025' }, 'en')).toBe('2025'))
  it('approximate', () => expect(formatPeriod({ start: '2023', end: '2025', approximate: true }, 'en')).toBe('c. 2023 – 2025'))
  it('approximate ko', () => expect(formatPeriod({ start: '2023', end: '2025', approximate: true }, 'ko')).toBe('2023 – 2025 (대략)'))
  it('legacy "Present" end', () => expect(formatPeriod({ start: '2025', end: 'Present' }, 'en')).toBe('2025 – Present'))
})
```
Run: `npx vitest run src/lib/format.test.ts` / Expected: 전부 FAIL ("TODO"). 여기서 에이전트는 멈추고 사이트 주인에게 넘긴다.

- [ ] **Step 4 (사이트 주인): 본문 구현** — 막히면 힌트 → 비슷한 예시 → 답 순서로 요청한다.

- [ ] **Step 5 (사이트 주인): 통과 확인** — Run: `npx vitest run src/lib/format.test.ts` / Expected: PASS

- [ ] **Step 6 (Claude): 리뷰** — 코드 리뷰 후, 사이트 주인이 "`formatPeriod`가 `approximate`를 어떻게 처리하는지"를 한두 문장으로 설명한다. 그 설명과 막힌 곳을 `01-typescript-basics.md` 끝에 "배운 것" 단락으로 남긴다 (5단계에서 Study 기록으로 옮김).

- [ ] **Step 7 (사이트 주인): Commit** — `git commit -m "feat: formatDate and formatPeriod"`

---

### Task 5 [Claude]: CV 페이지와 resume.json 정리

**배울 개념:** Zod 스키마로 JSON을 검사하는 법 (2단계 `[직접]` 작업의 예고편으로, 설명 노트를 자세히 쓴다).

**Files:**
- Modify: `content/resume.json`, `content/projects/korean-llm-benchmark.mdx`
- Create: `src/lib/cv/schema.ts`, `src/lib/cv/schema.test.ts`, `src/lib/cv/resume.ts`, `src/views/Cv.astro`, `src/pages/cv/index.astro`, `src/pages/ko/cv/index.astro`
- Move: `public/cv/woorim-shin-cv.pdf` (내용 확인, Step 1)

**Interfaces:**
- Consumes: `formatPeriod` (Task 4), `t`, `Locale` (Task 3). Task 4가 아직 끝나지 않았으면 Cv.astro는 Task 4 완료 후 빌드가 통과한다 — 순서상 Task 4 다음에 실행한다.
- Produces: `resumeSchema` (Zod), `type Resume = z.infer<typeof resumeSchema>`, `loadResume(): Resume`

- [ ] **Step 1: 콘텐츠 고치기**
  - `education[0].score` 삭제.
  - `work` Hiconsy: `startDate` `"2025-06"`. 첫 highlight의 "at a Korean CSAT education technology subsidiary"를 "at Hiconsy, the parent company of the Sidae Injae CSAT academy"로.
  - `korean-llm-benchmark.mdx`의 "six production models", "6 production LLMs"(3곳)를 "three"/"3"으로. "including models from OpenAI and Google"은 그대로 둔다.
  - `public/cv/woorim-shin-cv.pdf`를 열어 GPA가 있으면 파일을 지우고 CV 페이지의 PDF 링크를 뺀다. PDF는 내용을 고친 뒤 사이트 주인이 다시 넣는다 (계획 범위 밖).
  - `public/cv/talks/` 슬라이드는 그대로.

- [ ] **Step 2: 실패하는 테스트**

```ts
const valid = () => structuredClone(JSON.parse(readFileSync('content/resume.json', 'utf8')))
it('accepts the real resume', () => expect(resumeSchema.safeParse(valid()).success).toBe(true))
it('rejects a GPA score', () => {
  const r = valid(); r.education[0].score = 'GPA 4.0/4.5'
  expect(resumeSchema.safeParse(r).success).toBe(false)
})
it('accepts YYYY-MM dates', () => {
  const r = valid(); r.work[0].startDate = '2025-06'
  expect(resumeSchema.safeParse(r).success).toBe(true)
})
it('rejects a bad date', () => {
  const r = valid(); r.work[0].startDate = 'June 2025'
  expect(resumeSchema.safeParse(r).success).toBe(false)
})
it('rejects non-empty projects', () => {
  const r = valid(); r.projects = [{}]
  expect(resumeSchema.safeParse(r).success).toBe(false)
})
```

- [ ] **Step 3: 실패 확인** — Run: `npx vitest run src/lib/cv` / Expected: FAIL

- [ ] **Step 4: 구현** — `schema.ts`: 기존 `git show 1750447:lib/cv/schema.ts`의 구조를 Zod(`astro/zod`의 `z`)로 옮긴다. 날짜 `^(\d{4}(-\d{2}(-\d{2})?)?|Present)$`, `email`은 `z.email()`, 모든 객체 `z.strictObject` (모르는 필드 = 실패, 그래서 `score`가 거부됨), `education` 항목에서 `score` 필드 정의 삭제, `projects: z.array(z.never()).max(0).optional()`. `resume.ts`: 파일을 읽고 `safeParse` 실패 시 `content/resume.json is invalid:` + 각 오류 경로를 줄마다 붙여 throw.

- [ ] **Step 5: CV 화면** — `Cv.astro`는 기존 `app/cv/page.tsx`(git show로 확인)의 섹션 순서를 따른다: 이름·label·이메일·프로필 링크 → summary → Education → Experience → Publications → Talks → Awards → Skills → Languages. 날짜는 `formatPeriod(…, locale)`. featured 프로젝트 섹션은 뺀다 (경험 데이터가 2단계에서 생김). `ko`에서는 상단에 `t('ko','cv.contentInEnglish')`. 라우트 두 개가 `<Cv locale=… />`.

- [ ] **Step 6: 통과 확인** — Run: `npm test && npm run build && grep -c "Hiconsy" dist/cv/index.html dist/ko/cv/index.html` / Expected: PASS, 둘 다 1 이상

- [ ] **Step 7: 설명 노트** — `docs/learning/stage1-why.md`에 "Ajv 대신 Zod로 바꾼 이유, strictObject가 학점 노출을 막는 방식" 단락.

- [ ] **Step 8: Commit** — `git commit -m "feat: CV page from resume.json with a Zod schema; drop GPA, fix LLM count"`

---

### Task 6 [Claude]: 옛 글 18편 (목록, 본문, 태그, RSS, 사이트맵)

**배울 개념:** content collection, `getStaticPaths`로 글마다 페이지를 만드는 방식.

**Files:**
- Create: `src/lib/content/legacy.ts`, `src/lib/content/legacy.test.ts`, `src/content.config.ts`, `src/views/BlogIndex.astro`, `src/views/Post.astro`, `src/views/Tag.astro`, `src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`, `src/pages/blog/tags/[tag].astro`, 같은 세 파일의 `src/pages/ko/blog/…`, `src/lib/feed.ts`, `src/lib/feed.test.ts`, `src/pages/feed.xml.ts`
- Modify: `scripts/smoke.sh` (사이트맵 파일 이름)

**Interfaces:**
- Consumes: `formatDate` (Task 4), `t`, `localePath` (Task 3)
- Produces:
  - `legacySchema` (Zod, frontmatter용): `title: string`, `summary_en: string`, `lang: 'ko' | 'en'`, `date`/`updated?`: 문자열 또는 Date → `'YYYY-MM-DD'` 문자열, `tags: string[]` (각각 kebab-case, 기본값 `[]`)
  - `sortPosts<T extends { id: string; data: { date: string } }>(posts: T[]): T[]` — 날짜 내림차순, 같으면 id 오름차순
  - `tagIndex<T …>(posts: T[]): Map<string, T[]>` — 태그 알파벳순
  - `buildRss(input: { siteUrl: string; title: string; description: string; items: { url: string; title: string; date: string; summary: string }[] }): string`

- [ ] **Step 1: 실패하는 테스트**

```ts
// legacy.test.ts
it('keeps an unquoted YAML date on the same day', () => {
  const parsed = legacySchema.parse({ title: 't', summary_en: 's', lang: 'ko', date: new Date('2026-04-14T00:00:00Z'), tags: [] })
  expect(parsed.date).toBe('2026-04-14')
})
it('rejects a non-kebab tag', () => {
  expect(legacySchema.safeParse({ title: 't', summary_en: 's', lang: 'ko', date: '2026-04-14', tags: ['AWS'] }).success).toBe(false)
})
it('requires summary_en', () => {
  expect(legacySchema.safeParse({ title: 't', lang: 'ko', date: '2026-04-14' }).success).toBe(false)
})
it('sorts newest first, then by id', () => {
  const p = (id: string, date: string) => ({ id, data: { date } })
  expect(sortPosts([p('b', '2026-01-01'), p('a', '2026-01-01'), p('c', '2026-02-01')]).map((x) => x.id)).toEqual(['c', 'a', 'b'])
})
// feed.test.ts — 기존 lib/feed.test.ts의 XML 이스케이프 테스트를 새 입력 형태로 옮긴다
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib` / Expected: 새 테스트 FAIL

- [ ] **Step 3: 구현**
  - `legacy.ts`: 스키마와 두 함수. 기존 `validate.ts`의 규칙(KEBAB, ISO_DATE)을 Zod로.
  - `content.config.ts`: `legacy = defineCollection({ loader: glob({ pattern: '*.mdx', base: './content/legacy' }), schema: legacySchema })`. `base`가 프로젝트 루트 기준인지 문서로 확인하고, 엔트리 `id`가 파일 이름(확장자 제외)과 같은지 빌드 후 확인한다.
  - `Post.astro`: 날짜(`formatDate`), 제목, 화면 언어와 글 언어가 다르면 안내(`post.koreanOnly` + `summary_en`, 또는 `post.englishOnly`), 태그 링크, `<article lang={entry.data.lang}>` 안에 `render(entry)`의 `<Content />`. KaTeX CSS(`katex/dist/katex.min.css`)는 이 view에서만 import.
  - 이미지가 `public/`에 없으면 빌드가 실패하던 기존 검사(`findMissingAssets`)는 Task 2의 `check:links`가 `src=` 경로까지 확인하므로 옮기지 않는다.
  - `feed.xml.ts`: `export const GET`, 영어 경로 URL(`${site}/blog/${id}/`)로 18편. `site`는 `import.meta.env.SITE`.
  - `smoke.sh`: `sitemap.xml` 확인을 `sitemap-index.xml`로.

- [ ] **Step 4: 통과 확인**

Run: `npm test && npm run build && ls -d dist/blog/*/ | grep -vc '/tags/$' && ls -d dist/ko/blog/*/ | grep -vc '/tags/$' && grep -l 'class="katex' dist/blog/*/index.html | head -1 && grep -c 'lang="ko"' dist/blog/aws-database-concepts/index.html`
Expected: PASS, `18`, `18`, 수식이 있는 글 경로 하나, `lang="ko"` 1 이상.

- [ ] **Step 5: 브라우저 확인** — `npm run dev`로 `/blog/energy-attribution-model/`(표, 그림, 수식)과 `/ko/blog/energy-attribution-model/`(영어 글의 한국어 안내)를 연다. 표가 파이프 문자로 보이면 remark-gfm이 MDX에 적용되지 않은 것이다 (이전 레포에서 실제로 있었던 문제).

- [ ] **Step 6: 설명 노트** — "content collection이 하는 일, 라우트 파일 하나가 18개 페이지가 되는 원리" 단락.

- [ ] **Step 7: Commit** — `git commit -m "feat: legacy blog in en/ko routes with RSS and sitemap"`

---

### Task 7 [Claude]: 빌드 결과 검사 (`check:dist`)

**배울 개념:** "빌드는 됐지만 틀린" 상태를 잡는 마지막 관문.

**Files:**
- Create: `scripts/check-dist.ts`, `scripts/check-dist.test.ts`
- Modify: `package.json` (`verify`에 `check:dist` 추가)

**Interfaces:**
- Consumes: `localePath`, `LOCALES` (Task 3)
- Produces:
  - `missingPages(files: Set<string>, required: string[]): string[]`
  - `brokenRedirects(redirects: Record<string, string>, files: Set<string>): string[]`
  - `forbiddenText(pages: Map<string, string>, patterns: RegExp[]): string[]` — `"파일: 패턴"` 목록
  - `missingAlternates(pages: Map<string, string>): string[]` — `404.html`과 meta refresh 페이지는 제외

- [ ] **Step 1: 실패하는 테스트**

```ts
it('finds a missing page', () => {
  expect(missingPages(new Set(['index.html']), ['/', '/ko/'])).toEqual(['/ko/'])
})
it('decodes redirect targets', () => {
  expect(brokenRedirects({ '/forest/%EA%B0%80/': '/blog/ta-administration/' }, new Set(['blog/ta-administration/index.html']))).toEqual([])
  expect(brokenRedirects({ '/x/': '/blog/gone/' }, new Set())).toEqual(['/x/ -> /blog/gone/'])
})
it('flags a GPA anywhere', () => {
  expect(forbiddenText(new Map([['cv/index.html', '<p>GPA [removed]</p>']]), [/GPA/i, /0\.00/])).toEqual(['cv/index.html: /GPA/i', 'cv/index.html: /0\\.00/'])
})
it('requires both hreflang links', () => {
  const page = '<link rel="alternate" hreflang="en" href="/cv/">'
  expect(missingAlternates(new Map([['cv/index.html', page]]))).toEqual(['cv/index.html: ko'])
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run scripts/check-dist.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현** — `main()`: 필수 페이지 = `['/', '/cv/', '/blog/']`와 `content/legacy/*.mdx`마다 `/blog/<id>/`, 각각 `LOCALES` 전부에 대해 `localePath`; 여기에 `/404.html`, `/feed.xml`, `/sitemap-index.xml`. 리다이렉트 = `content/legacy/redirects.json`. 금지 패턴 = `[/GPA/i, /0\.00\s*\/\s*4\.5/]` (`.html`, `.xml`, `.txt`를 검사; PDF는 Task 5에서 처리). 하나라도 있으면 줄마다 출력하고 `exit 1`.

- [ ] **Step 4: 통과 확인** — Run: `npm run verify` / Expected: 모든 단계 ok, `check-dist: ok`

- [ ] **Step 5: Commit** — `git commit -m "chore: check built pages, redirect targets, hreflang and private text"`

---

### Task 8 [직접]: PR과 첫 배포

**배울 개념:** CI가 PR마다 하는 일, Workers 배포가 `dist/`를 올리는 방식. (git은 익숙하므로 짧게.)

- [ ] **Step 1:** `git push -u origin rebuild/astro`, PR 생성 (본문에 이 계획서 경로). CI `verify`가 초록인지 확인.
- [ ] **Step 2:** 로컬에서 `npx wrangler login` 후 `SITE_URL=https://rainyforest-web.<계정>.workers.dev BUILD_SHA=$(git rev-parse HEAD) npm run build && npx wrangler deploy`.
- [ ] **Step 3:** `SITE_URL=… EXPECTED_SHA=$(git rev-parse HEAD) ./scripts/smoke.sh` → `smoke: ok`.
- [ ] **Step 4:** 휴대폰으로 `/`, `/ko/cv/`, 수식 있는 글 하나를 열어 본다.
- [ ] **Step 5:** PR을 merge commit으로 합친다. `deploy.yml`은 계속 비활성 (도메인 구매 후 켬).
- [ ] **Step 6:** 1단계에서 배운 것과 막힌 곳을 `docs/learning/stage1-why.md` 끝에 몇 줄 남긴다 (5단계에서 첫 `kind: build` Study 기록이 됨).

---

## 실행 순서

1 → 2 → 3 → 4(직접) → 5 → 6 → 7 → 8(직접).
Task 4는 사이트 주인이 구현하는 동안 Claude가 멈춘다. 기다리지 않으려면 Task 4의 Step 1~3을 Task 3 직후에 넘기고, 사이트 주인이 구현하는 동안 Task 5·6의 `formatPeriod`/`formatDate`를 쓰지 않는 부분(스키마, 테스트)을 먼저 진행해도 된다. 이 경우 Task 5·6의 빌드 확인 단계는 Task 4가 끝난 뒤 실행한다.
