# Stage 2: CV·포트폴리오 페이지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/`, `/cv`, `/projects`, `/projects/[slug]`를 만들어, 지원서에 링크할 수 있는 최소 사이트를 로컬에서 완성한다.

**Architecture:** CV는 JSON Resume 스키마를 따르는 `content/resume.json` 하나를 원본으로 삼고, 빌드 시 스키마를 검증한다. 프로젝트는 `content/projects/*.mdx`에서 읽어 `Project` 타입으로 정규화한다. 두 소스 모두 빌드타임에만 읽히고, 페이지는 전부 정적 생성된다.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS 4, shadcn/ui(primitive만), gray-matter, next-mdx-remote-client, Ajv, Vitest

**Spec:** `docs/superpowers/specs/2026-09-19-personal-site-design.md` (§4.1 `Project`, §4.3, §5, §5.1, §5.2, §8.1, §10 2단계)

## Global Constraints

Stage 1 계획서의 Global Constraints를 그대로 따른다. 이번 단계에서 추가되는 것:

- CV 원본은 `content/resume.json` 하나다. `cv.yml`과 `assets/json/resume.json`의 중복은 이 파일로 합치고, 기존 두 파일은 가져오지 않는다.
- JSON Resume의 `projects` 필드는 **비워 둔다**. `/cv`의 프로젝트 섹션은 `content/projects/`의 `featured` 항목에서 파생한다(스펙 §5.1).
- 프로젝트 정렬에 수동 순번(al-folio의 `importance`)을 쓰지 않는다. `featured` → 진행 중 → 종료일 역순으로만 정렬한다.
- 프로젝트 목록에 썸네일을 넣지 않는다.
- 사이트 문구는 영문이다.
- `app/tokens.css` 밖에서 hex 색상·px 값을 쓰지 않는다. shadcn 컴포넌트를 가져온 뒤에도 이 규칙이 유지돼야 한다.
- 이번 단계는 AWS·도메인이 필요 없다. 배포는 하지 않는다.

## 출처 데이터

읽기 전용으로 참조한다. 원본 레포는 수정하지 않는다.

| 대상 | 경로 |
|---|---|
| CV 상세 (내용이 가장 풍부) | `~/Desktop/github/Woorim-Shin-cv/_data/cv.yml` |
| CV JSON (형식은 맞지만 내용이 얇음) | `~/Desktop/github/Woorim-Shin-cv/assets/json/resume.json` |
| 프로젝트 11개 | `~/Desktop/github/Woorim-Shin-cv/_projects/*.md` |
| 발표 슬라이드 PDF | `~/Desktop/github/Woorim-Shin-cv/assets/pdf/` |
| CV PDF (최신) | `~/Desktop/github/Woorim-Shin-cv/assets/pdf/260304cv.pdf` |

`papers.bib`은 실제 논문 항목이 없고(문자열 정의 1개뿐), 출판물은 `cv.yml`의 Publications 절에 HTML 문자열로 들어 있다. 따라서 **BibTeX 파서를 만들지 않는다.** 출판물은 `resume.json`의 `publications` 배열로 옮긴다.

## File Structure

```
content/
├─ resume.json              CV 단일 원본 (JSON Resume)
└─ projects/*.mdx           프로젝트 케이스 스터디 10개
lib/
├─ content/
│   ├─ model.ts             Post / Project / LinkGraph 타입 (이번엔 Project만 사용)
│   ├─ adapters/projects.ts MDX → Project
│   ├─ validate.ts          프로젝트 검증 게이트
│   └─ projects.ts          정렬된 Project[] 로딩 (페이지가 쓰는 진입점)
└─ cv/
    ├─ schema.ts            JSON Resume 부분 스키마 + 타입
    └─ resume.ts            로딩 + 검증
app/
├─ page.tsx                 홈
├─ cv/page.tsx              CV 전문
├─ projects/page.tsx        목록
└─ projects/[slug]/page.tsx 상세
components/site/
├─ project-card.tsx         목록 한 줄
├─ prose.tsx                MDX 본문 래퍼
└─ section.tsx              제목 + 본문 묶음
public/cv/woorim-shin-cv.pdf
```

---

### Task 1: CV 데이터 통합과 검증

**Files:**
- Create: `content/resume.json`, `lib/cv/schema.ts`, `lib/cv/resume.ts`, `public/cv/woorim-shin-cv.pdf`
- Test: `lib/cv/resume.test.ts`

**Interfaces:**
- Produces: `interface Resume`(아래 `schema.ts` 참조), `loadResume(): Resume`, `validateResume(data: unknown): string[]`(오류 메시지 배열, 빈 배열이면 통과)
- Produces: `content/resume.json`. Task 3의 `/cv`와 Task 5의 홈이 이 파일만 읽는다.

- [ ] **Step 1: 의존성 설치**

```bash
npm install -D ajv@8
```

- [ ] **Step 2: 실패하는 테스트 작성**

`lib/cv/resume.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { loadResume, validateResume } from './resume'

describe('validateResume', () => {
  it('accepts the real resume file', () => {
    expect(validateResume(loadResume())).toEqual([])
  })

  it('rejects a resume without basics.name', () => {
    expect(validateResume({ basics: { label: 'x' } }).join(' ')).toContain('name')
  })

  it('rejects a work entry without a position', () => {
    const errors = validateResume({
      basics: { name: 'X', label: 'y', email: 'a@b.c', summary: 's' },
      education: [],
      work: [{ name: 'Acme', startDate: '2020-01-01' }],
      publications: [],
      talks: [],
      awards: [],
      skills: [],
      languages: [],
    })
    expect(errors.join(' ')).toContain('position')
  })

  it('rejects dates that are not ISO or "Present"', () => {
    const errors = validateResume({
      basics: { name: 'X', label: 'y', email: 'a@b.c', summary: 's' },
      education: [],
      work: [{ name: 'Acme', position: 'Dev', startDate: 'Jan 2020' }],
      publications: [],
      talks: [],
      awards: [],
      skills: [],
      languages: [],
    })
    expect(errors.join(' ')).toContain('startDate')
  })
})

describe('loadResume', () => {
  it('keeps the JSON Resume projects array empty (projects live in content/projects)', () => {
    expect(loadResume().projects ?? []).toEqual([])
  })

  it('carries the sections the CV page renders', () => {
    const resume = loadResume()
    expect(resume.work.length).toBeGreaterThan(0)
    expect(resume.education.length).toBeGreaterThan(0)
    expect(resume.publications.length).toBeGreaterThan(0)
    expect(resume.talks.length).toBeGreaterThan(0)
    expect(resume.skills.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/cv/resume.test.ts`
Expected: FAIL. `./resume`를 찾을 수 없다는 오류.

- [ ] **Step 4: 스키마 작성**

JSON Resume 표준을 따르되, 표준에 없는 `talks`만 확장 필드로 추가한다(스펙 §5.2에서 "Technical Talks"를 CV로 옮기기로 했고, 표준에는 강연 섹션이 없다).

`lib/cv/schema.ts`:
```ts
export interface DateRange {
  startDate: string
  endDate?: string
}

export interface Resume {
  basics: {
    name: string
    label: string
    email: string
    summary: string
    location?: { city?: string; region?: string; countryCode?: string }
    profiles?: { network: string; username: string; url: string }[]
  }
  education: (DateRange & {
    institution: string
    area: string
    studyType: string
    score?: string
    courses?: string[]
    summary?: string
  })[]
  work: (DateRange & {
    name: string
    position: string
    location?: string
    highlights: string[]
  })[]
  publications: {
    name: string
    publisher: string
    releaseDate: string
    summary: string
  }[]
  talks: (DateRange & {
    title: string
    venue: string
    highlights: string[]
    slides?: string
  })[]
  awards: { title: string; date: string; awarder?: string; summary?: string }[]
  skills: { name: string; keywords: string[] }[]
  languages: { language: string; fluency: string }[]
  interests?: { name: string; keywords: string[] }[]
  /** Intentionally empty: portfolio projects live in content/projects (spec §5.1). */
  projects?: never[]
}

// Not `as const`: Ajv's compile() rejects deeply readonly schema objects.
const DATE = { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2}|\\d{4}|Present)$' }
const STRINGS = { type: 'array', items: { type: 'string' } }

export const resumeSchema = {
  type: 'object',
  required: ['basics', 'education', 'work', 'publications', 'talks', 'awards', 'skills', 'languages'],
  additionalProperties: false,
  properties: {
    basics: {
      type: 'object',
      required: ['name', 'label', 'email', 'summary'],
      properties: {
        name: { type: 'string' },
        label: { type: 'string' },
        email: { type: 'string', format: 'email' },
        summary: { type: 'string' },
        location: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            region: { type: 'string' },
            countryCode: { type: 'string' },
          },
        },
        profiles: {
          type: 'array',
          items: {
            type: 'object',
            required: ['network', 'username', 'url'],
            properties: {
              network: { type: 'string' },
              username: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        required: ['institution', 'area', 'studyType', 'startDate'],
        properties: {
          institution: { type: 'string' },
          area: { type: 'string' },
          studyType: { type: 'string' },
          startDate: DATE,
          endDate: DATE,
          score: { type: 'string' },
          courses: STRINGS,
          summary: { type: 'string' },
        },
      },
    },
    work: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'position', 'startDate', 'highlights'],
        properties: {
          name: { type: 'string' },
          position: { type: 'string' },
          location: { type: 'string' },
          startDate: DATE,
          endDate: DATE,
          highlights: STRINGS,
        },
      },
    },
    publications: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'publisher', 'releaseDate', 'summary'],
        properties: {
          name: { type: 'string' },
          publisher: { type: 'string' },
          releaseDate: DATE,
          summary: { type: 'string' },
        },
      },
    },
    talks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'venue', 'startDate', 'highlights'],
        properties: {
          title: { type: 'string' },
          venue: { type: 'string' },
          startDate: DATE,
          endDate: DATE,
          highlights: STRINGS,
          slides: { type: 'string' },
        },
      },
    },
    awards: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'date'],
        properties: {
          title: { type: 'string' },
          date: DATE,
          awarder: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'keywords'],
        properties: { name: { type: 'string' }, keywords: STRINGS },
      },
    },
    languages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['language', 'fluency'],
        properties: { language: { type: 'string' }, fluency: { type: 'string' } },
      },
    },
    interests: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'keywords'],
        properties: { name: { type: 'string' }, keywords: STRINGS },
      },
    },
    projects: { type: 'array', maxItems: 0 },
  },
}
```

- [ ] **Step 5: 로더 작성**

`lib/cv/resume.ts`:
```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { type Resume, resumeSchema } from './schema'

const RESUME_PATH = join(process.cwd(), 'content/resume.json')

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile(resumeSchema)

export function validateResume(data: unknown): string[] {
  if (validate(data)) return []
  return (validate.errors ?? []).map((e) => `resume${e.instancePath} ${e.message ?? 'is invalid'}`)
}

export function loadResume(): Resume {
  const data = JSON.parse(readFileSync(RESUME_PATH, 'utf8'))
  const errors = validateResume(data)
  if (errors.length > 0) {
    throw new Error(`content/resume.json is invalid:\n  ${errors.join('\n  ')}`)
  }
  return data as Resume
}
```

`ajv-formats`도 설치한다:
```bash
npm install -D ajv-formats@3
```

- [ ] **Step 6: `content/resume.json` 작성**

출처는 `~/Desktop/github/Woorim-Shin-cv/_data/cv.yml`이다. 그쪽이 `assets/json/resume.json`보다 내용이 풍부하다. 옮길 때 지킬 것:

- `cv.yml`의 `Experience` → `work`. `institution`을 `name`과 `location`으로 분리한다(예: `Hiconsy, Seoul, Korea` → `name: "Hiconsy"`, `location: "Seoul, Korea"`). `year: 2025 - 2026` → `startDate: "2025"`, `endDate: "2026"`. 진행 중이면 `endDate: "Present"`.
- `Education` → `education`. `GPA: 3.36/4.5`는 `score`로, `Expected Graduation: Feb. 2027`은 `endDate: "2027-02"`가 아니라 **`endDate: "2027"`**로 넣는다(스키마의 날짜 형식은 `YYYY-MM-DD`·`YYYY`·`Present`만 허용한다). Selected Coursework 항목들은 `courses` 배열로 펼친다.
- `Publications` → `publications`. HTML 태그(`<strong>`, `<em>`, `<sup>`)를 **모두 제거한다.** 렌더링은 컴포넌트가 하고, 데이터에는 마크업을 남기지 않는다. `name`에 논문 제목, `publisher`에 게재처(`Mathematics, MDPI (SCIE)`), `summary`에 저자 목록과 상태(`Submitted, Feb 2026. Equal contribution, co-first author.`)를 넣는다.
- `Talks & Sessions` → `talks`. `_projects/8_speaking_sessions.md`에 있는 정확한 날짜(`Oct. 1, 2025`)와 슬라이드 PDF 경로를 함께 반영한다. `slides`는 `/cv/talks/<파일명>.pdf` 형태의 사이트 내 경로로 적고, 해당 PDF를 `public/cv/talks/`로 복사한다.
- `Honors and Awards` → `awards`. 문자열 하나를 `title`과 `summary`로 나눈다.
- `Academic Interests` → `interests`(`nested_list`의 각 `title`이 `name`, 하위 항목이 `keywords`).
- `Technical Skills` → `skills`. `<u>Languages:</u> Python, Rust, ...` 형태에서 태그를 제거하고 `name: "Languages"`, `keywords: ["Python", "Rust", ...]`로 나눈다.
- `basics`는 기존 `assets/json/resume.json`의 값을 쓰되, `summary`는 현재 상태에 맞게 다듬는다.
- `projects`는 넣지 않는다.

CV PDF도 복사한다:
```bash
mkdir -p public/cv/talks
cp ~/Desktop/github/Woorim-Shin-cv/assets/pdf/260304cv.pdf public/cv/woorim-shin-cv.pdf
cp ~/Desktop/github/Woorim-Shin-cv/assets/pdf/20251001-gdg-membersession.pdf public/cv/talks/gdgoc-portfolio-session.pdf
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npx vitest run lib/cv/resume.test.ts`
Expected: PASS, 6개 테스트. 실패하면 오류 메시지가 가리키는 필드를 `content/resume.json`에서 고친다. 스키마를 느슨하게 고치는 방식으로 통과시키지 않는다.

- [ ] **Step 8: Commit**

```bash
npm run verify
git add content/resume.json lib/cv public/cv package.json package-lock.json
git commit -m "feat: merge cv.yml and resume.json into one validated JSON Resume source" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 프로젝트 어댑터와 검증 게이트

**Files:**
- Create: `lib/content/model.ts`, `lib/content/adapters/projects.ts`, `lib/content/validate.ts`, `lib/content/projects.ts`
- Test: `lib/content/adapters/projects.test.ts`, `lib/content/projects.test.ts`

**Interfaces:**
- Produces: `interface Project`(스펙 §4.1과 동일한 필드), `parseProject(fileName: string, raw: string): Project`, `validateProjects(projects: Project[]): string[]`, `loadProjects(): Project[]`(정렬 완료), `getProject(slug: string): Project | undefined`
- 정렬 규칙: `featured`가 먼저, 그다음 진행 중(`period.end`가 없는 것), 그다음 `period.end` 내림차순. 동률이면 `period.start` 내림차순.
- MDX 본문은 `Project.body`에 문자열로 담긴다. 렌더링은 Task 4가 한다.

- [ ] **Step 1: 의존성 설치**

```bash
npm install gray-matter@4
```

- [ ] **Step 2: 실패하는 테스트 작성**

`lib/content/adapters/projects.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseProject } from './projects'

const raw = `---
title: "fcoinman: Linux Server Compromise Detector"
summary: Single-binary Linux compromise detector written in Rust
outcome: Found a CPU miner, GPU miner and IRC botnet on a live server
period:
  start: "2026-05"
role: Independent Developer
stack: [Rust, Linux]
category: systems
featured: true
links:
  repo: https://github.com/RainyForest23/fcoinman
---

## Origin

It started at 3am.
`

describe('parseProject', () => {
  it('derives the slug from the file name', () => {
    expect(parseProject('fcoinman.mdx', raw).slug).toBe('fcoinman')
  })

  it('reads the structured fields from frontmatter', () => {
    const project = parseProject('fcoinman.mdx', raw)
    expect(project.title).toBe('fcoinman: Linux Server Compromise Detector')
    expect(project.role).toBe('Independent Developer')
    expect(project.stack).toEqual(['Rust', 'Linux'])
    expect(project.category).toBe('systems')
    expect(project.featured).toBe(true)
    expect(project.period).toEqual({ start: '2026-05' })
    expect(project.links?.repo).toBe('https://github.com/RainyForest23/fcoinman')
  })

  it('keeps the body as MDX without the frontmatter', () => {
    const project = parseProject('fcoinman.mdx', raw)
    expect(project.body.trim().startsWith('## Origin')).toBe(true)
    expect(project.body).not.toContain('title:')
  })

  it('defaults featured to false when absent', () => {
    const without = raw.replace('featured: true\n', '')
    expect(parseProject('fcoinman.mdx', without).featured).toBe(false)
  })
})
```

`lib/content/projects.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Project } from './model'
import { sortProjects } from './projects'
import { validateProjects } from './validate'

function project(overrides: Partial<Project>): Project {
  return {
    slug: 's',
    title: 't',
    summary: 'one line',
    period: { start: '2025-01' },
    role: 'Independent Developer',
    stack: ['Rust'],
    category: 'systems',
    featured: false,
    body: '',
    ...overrides,
  }
}

describe('sortProjects', () => {
  it('puts featured projects first', () => {
    const sorted = sortProjects([
      project({ slug: 'plain', period: { start: '2026-01', end: '2026-06' } }),
      project({ slug: 'star', featured: true, period: { start: '2020-01', end: '2020-02' } }),
    ])
    expect(sorted.map((p) => p.slug)).toEqual(['star', 'plain'])
  })

  it('puts ongoing work before finished work', () => {
    const sorted = sortProjects([
      project({ slug: 'done', period: { start: '2026-01', end: '2026-06' } }),
      project({ slug: 'ongoing', period: { start: '2025-01' } }),
    ])
    expect(sorted.map((p) => p.slug)).toEqual(['ongoing', 'done'])
  })

  it('orders finished work by end date, newest first', () => {
    const sorted = sortProjects([
      project({ slug: 'older', period: { start: '2024-01', end: '2024-06' } }),
      project({ slug: 'newer', period: { start: '2025-01', end: '2025-06' } }),
    ])
    expect(sorted.map((p) => p.slug)).toEqual(['newer', 'older'])
  })
})

describe('validateProjects', () => {
  it('accepts a well-formed set', () => {
    expect(validateProjects([project({ slug: 'a' }), project({ slug: 'b' })])).toEqual([])
  })

  it('rejects duplicate slugs', () => {
    expect(validateProjects([project({ slug: 'a' }), project({ slug: 'a' })]).join(' ')).toContain(
      'duplicate slug',
    )
  })

  it('rejects a missing required field', () => {
    const broken = project({ slug: 'a', role: '' })
    expect(validateProjects([broken]).join(' ')).toContain('role')
  })

  it('rejects an unknown category', () => {
    const broken = project({ slug: 'a', category: 'marketing' as Project['category'] })
    expect(validateProjects([broken]).join(' ')).toContain('category')
  })

  it('rejects an end date earlier than the start date', () => {
    const broken = project({ slug: 'a', period: { start: '2026-05', end: '2026-01' } })
    expect(validateProjects([broken]).join(' ')).toContain('end')
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/content`
Expected: FAIL. `./projects`, `./model`, `./validate`를 찾을 수 없다는 오류.

- [ ] **Step 4: 타입 정의**

스펙 §4.1의 `Project`를 그대로 옮긴다. `Post`와 `LinkGraph`도 함께 정의해 두되, 이번 단계에서는 쓰지 않는다. 3·4단계가 같은 파일에 이어 붙인다.

`lib/content/model.ts`:
```ts
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
```

- [ ] **Step 5: 어댑터 구현**

`lib/content/adapters/projects.ts`:
```ts
import matter from 'gray-matter'
import type { Project } from '../model'

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
```

프론트매터가 잘못돼 있으면 여기서 막지 않고 `validateProjects`가 잡는다. 파싱과 검증을 분리해야 오류를 한 번에 모아 보여줄 수 있다.

- [ ] **Step 6: 검증 게이트 구현**

`lib/content/validate.ts`:
```ts
import { PROJECT_CATEGORIES, type Project } from './model'

const REQUIRED = ['title', 'summary', 'role', 'category'] as const

export function validateProjects(projects: Project[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const p of projects) {
    const where = `projects/${p.slug}`
    if (seen.has(p.slug)) errors.push(`${where}: duplicate slug`)
    seen.add(p.slug)

    for (const field of REQUIRED) {
      if (!p[field]) errors.push(`${where}: ${field} is required`)
    }
    if (!PROJECT_CATEGORIES.includes(p.category)) {
      errors.push(`${where}: category must be one of ${PROJECT_CATEGORIES.join(', ')}`)
    }
    if (p.stack.length === 0) errors.push(`${where}: stack must list at least one technology`)
    if (!p.period?.start) errors.push(`${where}: period.start is required`)
    if (p.period?.end && p.period.end < p.period.start) {
      errors.push(`${where}: period.end is earlier than period.start`)
    }
  }
  return errors
}
```

- [ ] **Step 7: 로더와 정렬 구현**

`lib/content/projects.ts`:
```ts
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseProject } from './adapters/projects'
import type { Project } from './model'
import { validateProjects } from './validate'

const DIR = join(process.cwd(), 'content/projects')

export function sortProjects(projects: Project[]): Project[] {
  const rank = (p: Project) => (p.featured ? 0 : 1)
  return [...projects].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    const ongoing = (p: Project) => (p.period.end ? 1 : 0)
    if (ongoing(a) !== ongoing(b)) return ongoing(a) - ongoing(b)
    const byEnd = (b.period.end ?? '').localeCompare(a.period.end ?? '')
    return byEnd !== 0 ? byEnd : b.period.start.localeCompare(a.period.start)
  })
}

export function loadProjects(): Project[] {
  const projects = readdirSync(DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => parseProject(f, readFileSync(join(DIR, f), 'utf8')))

  const errors = validateProjects(projects)
  if (errors.length > 0) {
    throw new Error(`content/projects is invalid:\n  ${errors.join('\n  ')}`)
  }
  return sortProjects(projects)
}

export function getProject(slug: string): Project | undefined {
  return loadProjects().find((p) => p.slug === slug)
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npx vitest run lib/content`
Expected: PASS, 12개 테스트.

- [ ] **Step 9: Commit**

```bash
npm run verify
git add lib/content package.json package-lock.json
git commit -m "feat: parse, validate and sort portfolio projects" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 프로젝트 10개 변환

**Files:**
- Create: `content/projects/*.mdx` (10개)

**Interfaces:**
- Consumes: Task 2의 `loadProjects()`
- Produces: `content/projects/` 아래 10개 파일. slug는 아래 표로 고정한다. 한 번 공개되면 바뀌면 안 되는 URL이다.

- [ ] **Step 1: slug와 메타데이터 확정**

`~/Desktop/github/Woorim-Shin-cv/_projects/`의 11개 중 `8_speaking_sessions.md`는 제외한다(Task 1에서 CV의 `talks`로 옮겼다).

| 원본 | slug | category |
|---|---|---|
| `1_korean_asr.md` | `korean-lecture-asr` | ai |
| `2_qa_analysis.md` | `csat-qa-classification` | ai |
| `3_sentiment_analysis.md` | `student-sentiment-analysis` | data |
| `4_learning_analytics.md` | `learning-analytics-automation` | data |
| `5_web_crawling.md` | `educational-forum-crawler` | data |
| `6_energy_cost_model.md` | `ai-energy-cost-model` | research |
| `7_llm_benchmark.md` | `korean-llm-benchmark` | research |
| `9_convpeft.md` | `convpeft` | research |
| `10_fcoinman.md` | `fcoinman` | systems |
| `11_vm_power_attribution.md` | `vm-power-attribution` | research |

- [ ] **Step 2: 변환 규칙에 따라 파일 작성**

각 파일에 대해:

1. al-folio 프론트매터(`layout`, `img`, `importance`, `related_publications`)는 버린다.
2. 본문 첫 줄의 `**Jun. 2025 – Feb. 2026 | PyTorch, HuggingFace, LoRA | Independent Developer**`를 분해해 프론트매터로 올린다. `period.start`/`period.end`(`YYYY-MM` 또는 `YYYY`), `stack`, `role`, 괄호 안의 인원은 `teamSize`.
3. 본문에서 그 한 줄을 삭제한다. 중복 표시를 없앤다.
4. 본문 맨 위의 `## <제목>` 반복도 삭제한다. 제목은 페이지가 렌더링한다.
5. `> [GitHub → ...]` 인용 링크는 `links.repo`로 올리고 본문에서 지운다.
6. `{{ site.baseurl }}/assets/pdf/...` 형태의 Jekyll 경로가 있으면 PDF를 `public/projects/<slug>/`로 복사하고 `links.slides`(또는 `links.paper`)로 올린다.
7. `<div class="col-sm ...">` 같은 Bootstrap 마크업은 삭제한다. 사이트에 그 CSS가 없다.
8. `summary`는 원본 `description`을 한 문장으로 다듬어 쓴다.
9. `outcome`은 본문에서 가장 강한 결과 한 줄을 골라 쓴다. 없으면 생략한다.
10. `featured: true`는 3~4개에만 붙인다. 후보: `korean-lecture-asr`, `ai-energy-cost-model`, `fcoinman`, `vm-power-attribution`.

`content/projects/fcoinman.mdx` 예시(다른 파일도 같은 형태로 만든다):
```mdx
---
title: "fcoinman: Linux Server Compromise Detector"
summary: Single-binary Linux compromise detector written in Rust, built after a real intrusion.
outcome: Detects miner, botnet and rootkit persistence in one scan; ships as an 860KB static binary with no agent or config.
period:
  start: "2026-05"
  end: "2026-05"
role: Independent Developer
stack: [Rust, Linux, musl]
category: systems
featured: true
links:
  repo: https://github.com/RainyForest23/fcoinman
---

### Origin

My Ubuntu server started making loud fan noises at 3am...
```

- [ ] **Step 3: 로더로 전수 확인**

```bash
npx tsx -e "import('./lib/content/projects.ts').then(async (m) => {
  const projects = m.loadProjects()
  console.log('count:', projects.length)
  for (const p of projects) {
    console.log([p.featured ? '*' : ' ', p.slug, p.period.start + '-' + (p.period.end ?? 'now'), p.category, p.stack.join('/')].join('  '))
  }
})"
```
Expected: `count: 10`이 출력되고, featured 항목이 목록 맨 위에 모여 있으며, 검증 오류가 없다. 오류가 나면 메시지가 파일과 필드를 가리킨다.

- [ ] **Step 4: Commit**

```bash
npm run verify
git add content/projects public/projects
git commit -m "feat: migrate ten portfolio projects from the al-folio site" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: 프로젝트 페이지

**Files:**
- Create: `components/site/section.tsx`, `components/site/prose.tsx`, `components/site/project-card.tsx`
- Create: `app/projects/page.tsx`, `app/projects/[slug]/page.tsx`
- Modify: `app/tokens.css` (본문 타이포그래피 토큰 추가)

**Interfaces:**
- Consumes: `loadProjects()`, `getProject()`(Task 2)
- Produces: `/projects/`와 `/projects/<slug>/` 정적 페이지. Task 5의 홈이 `ProjectCard`를 재사용한다.
- Produces: `formatPeriod(period: Project['period']): string` — `lib/content/format.ts`. 예: `{start:'2025-06', end:'2026-02'}` → `Jun 2025 – Feb 2026`, end 없으면 `Jun 2025 – Present`.

- [ ] **Step 1: MDX 의존성 설치**

```bash
npm install next-mdx-remote-client@2
```

`next-mdx-remote-client`는 App Router의 서버 컴포넌트에서 문자열 MDX를 렌더링한다. `@next/mdx`는 파일 기반이라 `content/`에 있는 파일에 맞지 않는다.

- [ ] **Step 2: 기간 포맷 함수 테스트 작성**

`lib/content/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatPeriod } from './format'

describe('formatPeriod', () => {
  it('formats a closed range', () => {
    expect(formatPeriod({ start: '2025-06', end: '2026-02' })).toBe('Jun 2025 – Feb 2026')
  })

  it('marks an open range as ongoing', () => {
    expect(formatPeriod({ start: '2026-02' })).toBe('Feb 2026 – Present')
  })

  it('accepts year-only dates', () => {
    expect(formatPeriod({ start: '2025', end: '2026' })).toBe('2025 – 2026')
  })

  it('collapses a range that starts and ends in the same month', () => {
    expect(formatPeriod({ start: '2026-05', end: '2026-05' })).toBe('May 2026')
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/content/format.test.ts`
Expected: FAIL. `./format`을 찾을 수 없다.

- [ ] **Step 4: 포맷 함수 구현**

`lib/content/format.ts`:
```ts
import type { Project } from './model'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function label(date: string): string {
  const [year, month] = date.split('-')
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year
}

export function formatPeriod(period: Project['period']): string {
  const start = label(period.start)
  if (!period.end) return `${start} – Present`
  const end = label(period.end)
  return start === end ? start : `${start} – ${end}`
}
```

Run: `npx vitest run lib/content/format.test.ts` → PASS, 4개.

- [ ] **Step 5: 공통 컴포넌트**

`components/site/section.tsx`:
```tsx
import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}
```

`components/site/prose.tsx`:
```tsx
import { MDXRemote } from 'next-mdx-remote-client/rsc'

export function Prose({ source }: { source: string }) {
  return (
    <div className="prose-body">
      <MDXRemote source={source} />
    </div>
  )
}
```

`prose-body` 스타일은 Step 8에서 `tokens.css`에 넣는다. Tailwind Typography 플러그인은 쓰지 않는다. 플러그인이 자체 색·간격 값을 들고 와서 토큰 규칙과 충돌한다.

`components/site/project-card.tsx`:
```tsx
import Link from 'next/link'
import { formatPeriod } from '@/lib/content/format'
import type { Project } from '@/lib/content/model'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <h3 className="text-lg font-semibold">
        <Link href={`/projects/${project.slug}/`} className="hover:underline">
          {project.title}
        </Link>
      </h3>
      <p className="mt-1 text-fg-muted">{project.summary}</p>
      <p className="mt-2 text-sm text-fg-muted">
        {project.role}
        {project.teamSize ? ` (team of ${project.teamSize})` : ''} — {formatPeriod(project.period)} —{' '}
        {project.stack.join(', ')}
      </p>
      {project.outcome ? <p className="mt-2 text-sm">{project.outcome}</p> : null}
    </article>
  )
}
```

- [ ] **Step 6: 목록 페이지**

`app/projects/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { ProjectCard } from '@/components/site/project-card'
import { loadProjects } from '@/lib/content/projects'

export const metadata: Metadata = {
  title: 'Projects — Woorim Shin',
  description: 'Selected engineering and research projects.',
}

export default function ProjectsPage() {
  const projects = loadProjects()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Projects</h1>
      <div className="mt-10">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </main>
  )
}
```

카테고리 필터는 넣지 않는다. 항목이 10개뿐이라 필터가 값을 더하지 않는다. 20개가 넘어가면 그때 추가한다.

- [ ] **Step 7: 상세 페이지**

`app/projects/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Prose } from '@/components/site/prose'
import { formatPeriod } from '@/lib/content/format'
import { getProject, loadProjects } from '@/lib/content/projects'

export function generateStaticParams() {
  return loadProjects().map((project) => ({ slug: project.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) return {}
  return { title: `${project.title} — Woorim Shin`, description: project.summary }
}

const LINK_LABELS: Record<string, string> = {
  repo: 'Repository',
  paper: 'Paper',
  demo: 'Demo',
  slides: 'Slides',
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) notFound()

  const links = Object.entries(project.links ?? {})

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">{project.title}</h1>
      <p className="mt-2 text-fg-muted">{project.summary}</p>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-fg-muted">Role</dt>
        <dd>
          {project.role}
          {project.teamSize ? ` (team of ${project.teamSize})` : ''}
        </dd>
        <dt className="text-fg-muted">Period</dt>
        <dd>{formatPeriod(project.period)}</dd>
        <dt className="text-fg-muted">Stack</dt>
        <dd>{project.stack.join(', ')}</dd>
      </dl>
      {links.length > 0 ? (
        <p className="mt-4 text-sm">
          {links.map(([key, href]) => (
            <a key={key} href={href} className="mr-4 underline">
              {LINK_LABELS[key] ?? key}
            </a>
          ))}
        </p>
      ) : null}
      <div className="mt-10">
        <Prose source={project.body} />
      </div>
    </main>
  )
}
```

- [ ] **Step 8: 본문 스타일 토큰**

`app/tokens.css`의 `@theme` 블록에 선을 위한 색을 추가하고, 파일 끝에 본문 스타일을 넣는다. 이 파일 안에서는 hex·px를 써도 된다.

```css
/* @theme 안에 추가 */
--color-line: #d8dee4;

/* 다크 모드 :root 안에 추가 */
--color-line: #2a3038;

/* 파일 끝에 추가 */
.prose-body {
  line-height: 1.7;
}
.prose-body h3 {
  margin-top: 2rem;
  font-size: 1.125rem;
  font-weight: 600;
}
.prose-body p,
.prose-body ul,
.prose-body table,
.prose-body pre {
  margin-top: 1rem;
}
.prose-body ul {
  list-style: disc;
  padding-left: 1.25rem;
}
.prose-body a {
  text-decoration: underline;
}
.prose-body code {
  font-size: 0.9em;
}
.prose-body pre {
  overflow-x: auto;
  padding: 1rem;
  background: color-mix(in oklab, var(--color-fg) 6%, transparent);
}
.prose-body table {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
}
.prose-body th,
.prose-body td {
  border: 1px solid var(--color-line);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
```

- [ ] **Step 9: 빌드로 정적 생성 확인**

```bash
npm run build
ls out/projects/index.html out/projects/fcoinman/index.html
grep -c "<h3" out/projects/index.html
```
Expected: 두 파일이 존재하고, 목록 페이지에 `<h3`가 10개 있다.

- [ ] **Step 10: Commit**

```bash
npm run verify
git add app/projects components/site lib/content/format.ts lib/content/format.test.ts app/tokens.css package.json package-lock.json
git commit -m "feat: add projects list and case study pages" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: CV 페이지와 홈

**Files:**
- Create: `app/cv/page.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx`
- Create: `components/site/site-header.tsx`

**Interfaces:**
- Consumes: `loadResume()`(Task 1), `loadProjects()`·`ProjectCard`(Task 2·4)
- Produces: `/cv/`, `/` 정적 페이지와 공통 헤더

- [ ] **Step 1: 공통 헤더**

`components/site/site-header.tsx`:
```tsx
import Link from 'next/link'

const NAV = [
  { href: '/cv/', label: 'CV' },
  { href: '/projects/', label: 'Projects' },
]

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-3xl items-baseline justify-between px-6 py-6">
      <Link href="/" className="font-semibold">
        Woorim Shin
      </Link>
      <nav className="flex gap-6 text-sm">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="hover:underline">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
```

`app/layout.tsx`의 `<body>` 안, `{children}` 위에 `<SiteHeader />`를 넣는다. 블로그 링크는 3단계에서 추가한다.

- [ ] **Step 2: CV 페이지**

`app/cv/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { Section } from '@/components/site/section'
import { loadProjects } from '@/lib/content/projects'
import { formatPeriod } from '@/lib/content/format'
import { loadResume } from '@/lib/cv/resume'

export const metadata: Metadata = {
  title: 'CV — Woorim Shin',
  description: 'Education, experience, publications and talks.',
}

export default function CvPage() {
  const resume = loadResume()
  const featured = loadProjects().filter((project) => project.featured)

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-baseline justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold">{resume.basics.name}</h1>
          <p className="mt-1 text-fg-muted">{resume.basics.label}</p>
        </div>
        <a href="/cv/woorim-shin-cv.pdf" className="text-sm underline">
          Download PDF
        </a>
      </div>
      <p className="mt-6">{resume.basics.summary}</p>

      <Section title="Education">
        {resume.education.map((entry) => (
          <div key={entry.institution} className="mt-4 first:mt-0">
            <p className="font-medium">
              {entry.studyType}, {entry.area}
            </p>
            <p className="text-sm text-fg-muted">
              {entry.institution} — {formatPeriod({ start: entry.startDate, end: entry.endDate })}
              {entry.score ? ` — ${entry.score}` : ''}
            </p>
            {entry.courses?.length ? (
              <p className="mt-1 text-sm text-fg-muted">
                Coursework: {entry.courses.join(', ')}
              </p>
            ) : null}
          </div>
        ))}
      </Section>

      <Section title="Experience">
        {resume.work.map((job) => (
          <div key={`${job.name}-${job.startDate}`} className="mt-6 first:mt-0">
            <p className="font-medium">
              {job.position} — {job.name}
            </p>
            <p className="text-sm text-fg-muted">
              {job.location ? `${job.location} — ` : ''}
              {formatPeriod({ start: job.startDate, end: job.endDate })}
            </p>
            <ul className="mt-2 list-disc pl-5">
              {job.highlights.map((line) => (
                <li key={line} className="mt-1">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Publications">
        {resume.publications.map((paper) => (
          <div key={paper.name} className="mt-4 first:mt-0">
            <p className="font-medium">{paper.name}</p>
            <p className="text-sm text-fg-muted">
              {paper.publisher} — {paper.releaseDate}
            </p>
            <p className="mt-1 text-sm">{paper.summary}</p>
          </div>
        ))}
      </Section>

      <Section title="Selected projects">
        <ul className="list-disc pl-5">
          {featured.map((project) => (
            <li key={project.slug} className="mt-1">
              <a href={`/projects/${project.slug}/`} className="underline">
                {project.title}
              </a>{' '}
              <span className="text-fg-muted">— {project.summary}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Talks">
        {resume.talks.map((talk) => (
          <div key={talk.title} className="mt-4 first:mt-0">
            <p className="font-medium">
              {talk.title}
              {talk.slides ? (
                <>
                  {' '}
                  <a href={talk.slides} className="text-sm underline">
                    (slides)
                  </a>
                </>
              ) : null}
            </p>
            <p className="text-sm text-fg-muted">
              {talk.venue} — {formatPeriod({ start: talk.startDate, end: talk.endDate })}
            </p>
          </div>
        ))}
      </Section>

      <Section title="Awards">
        <ul className="list-disc pl-5">
          {resume.awards.map((award) => (
            <li key={award.title} className="mt-1">
              {award.title} <span className="text-fg-muted">({award.date})</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Skills">
        {resume.skills.map((group) => (
          <p key={group.name} className="mt-2 first:mt-0">
            <span className="font-medium">{group.name}:</span>{' '}
            <span className="text-fg-muted">{group.keywords.join(', ')}</span>
          </p>
        ))}
      </Section>

      <Section title="Languages">
        <p className="text-fg-muted">
          {resume.languages.map((l) => `${l.language} (${l.fluency})`).join(', ')}
        </p>
      </Section>
    </main>
  )
}
```

`formatPeriod`는 `YYYY`와 `YYYY-MM`을 받는데 `resume.json`의 날짜는 `YYYY-MM-DD`일 수 있다. Step 4에서 이 경우를 테스트로 확인한다.

- [ ] **Step 3: 홈**

`app/page.tsx`를 다시 쓴다.
```tsx
import Link from 'next/link'
import { ProjectCard } from '@/components/site/project-card'
import { Section } from '@/components/site/section'
import { loadProjects } from '@/lib/content/projects'
import { loadResume } from '@/lib/cv/resume'

export default function Home() {
  const resume = loadResume()
  const featured = loadProjects().filter((project) => project.featured)

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">{resume.basics.name}</h1>
      <p className="mt-4 text-lg">{resume.basics.summary}</p>
      <p className="mt-4 text-sm text-fg-muted">
        {resume.basics.location?.city}, {resume.basics.location?.region} —{' '}
        <a href={`mailto:${resume.basics.email}`} className="underline">
          {resume.basics.email}
        </a>
        {resume.basics.profiles?.map((profile) => (
          <span key={profile.network}>
            {' — '}
            <a href={profile.url} className="underline">
              {profile.network}
            </a>
          </span>
        ))}
      </p>

      <Section title="Selected work">
        <div>
          {featured.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
        <p className="mt-6 text-sm">
          <Link href="/projects/" className="underline">
            All projects
          </Link>
        </p>
      </Section>
    </main>
  )
}
```

- [ ] **Step 4: 날짜 형식 테스트 추가**

`lib/content/format.test.ts`에 덧붙인다:
```ts
it('accepts full ISO dates as they appear in resume.json', () => {
  expect(formatPeriod({ start: '2023-03-01', end: '2027' })).toBe('Mar 2023 – 2027')
})

it('treats "Present" as an open range', () => {
  expect(formatPeriod({ start: '2025-06-01', end: 'Present' })).toBe('Jun 2025 – Present')
})
```

`formatPeriod`를 고친다:
```ts
export function formatPeriod(period: Project['period']): string {
  const start = label(period.start)
  if (!period.end || period.end === 'Present') return `${start} – Present`
  const end = label(period.end)
  return start === end ? start : `${start} – ${end}`
}
```
`label`은 `date.split('-')`의 앞 두 조각만 쓰므로 `YYYY-MM-DD`도 그대로 처리된다.

Run: `npx vitest run lib/content/format.test.ts` → PASS, 6개.

- [ ] **Step 5: 빌드와 눈으로 확인**

```bash
npm run build
ls out/index.html out/cv/index.html out/projects/index.html
npm run dev
```
브라우저에서 `/`, `/cv/`, `/projects/`, 프로젝트 상세 하나를 연다. 확인할 것:
- 헤더 링크가 동작한다.
- CV의 모든 섹션에 내용이 있다(빈 섹션이 보이면 `content/resume.json`에 해당 항목이 비어 있는 것이다).
- PDF 다운로드 링크가 열린다.
- 모바일 폭(400px)에서 가로 스크롤이 생기지 않는다. 표가 있는 프로젝트 상세에서 특히 확인한다.

- [ ] **Step 6: Commit**

```bash
npm run verify
git add app components/site lib/content/format.ts lib/content/format.test.ts
git commit -m "feat: add CV page and rebuild the home page from real content" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: shadcn/ui 초기화

마지막에 두는 이유: 여기까지는 shadcn 컴포넌트가 필요한 화면이 없다. 실제로 필요해질 때(3단계의 `⌘K` 검색, 4단계의 그래프 토글) 설치하면 되지만, **토큰 규칙과 충돌하지 않는지**는 미리 확인해 두는 편이 낫다. 충돌을 3단계에서 발견하면 그때 작업이 막힌다.

**Files:**
- Create: `components.json`, `components/primitives/button.tsx`, `lib/utils.ts`
- Modify: `app/tokens.css` (shadcn이 요구하는 토큰 이름 추가)

**Interfaces:**
- Produces: `components/primitives/`에 shadcn 컴포넌트가 놓이는 규약. 3단계의 Command 팔레트가 같은 위치를 쓴다.

- [ ] **Step 1: 초기화**

```bash
npx shadcn@latest init
```

물어보는 항목에 이렇게 답한다: base color는 Neutral, CSS 변수 사용은 yes, 컴포넌트 경로는 `components/primitives`, 유틸 경로는 `lib/utils`.

- [ ] **Step 2: 토큰 규칙 위반 확인**

```bash
npm run check:tokens
```

shadcn은 `app/globals.css`에 자체 색 변수를 hex나 oklch로 직접 써 넣는다. 위반이 보고되면 **그 값들을 `app/tokens.css`로 옮긴다.** `globals.css`에는 `@import`와 최소한의 규칙만 남긴다. 이 단계의 목적이 바로 이 정리다.

- [ ] **Step 3: 컴포넌트 하나로 검증**

```bash
npx shadcn@latest add button
```

`components/primitives/button.tsx`가 생긴다. `app/projects/page.tsx`에 임시로 `<Button>Test</Button>`을 넣고 `npm run build`가 통과하는지, `npm run check:tokens`가 여전히 통과하는지 확인한 뒤 임시 코드를 지운다.

- [ ] **Step 4: Commit**

```bash
npm run verify
git add components.json components/primitives lib/utils.ts app/tokens.css app/globals.css package.json package-lock.json
git commit -m "chore: initialise shadcn/ui primitives under the token system" \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## 2단계 완료 기준

- `npm run verify` 통과
- `/`, `/cv/`, `/projects/`, `/projects/<slug>/` 10개가 모두 정적 생성됨
- CV 데이터가 `content/resume.json` 한 곳에만 있음
- 프로젝트 정렬에 수동 순번이 없음
- `app/tokens.css` 밖에 hex·px 값이 없음 (shadcn 설치 후에도)

배포는 하지 않는다. 도메인을 구매한 뒤 1단계 Task 6을 수행하면 이 결과물이 그대로 올라간다.

## 3단계에서 이어서 할 일

- 레거시 포스트 24개 변환, `/blog`, 태그 인덱스, RSS
- 헤더에 Blog 링크 추가
- `sitemap.xml`과 `feed.xml` 생성 (스펙 §5)
- lychee로 내부 링크 전수 검사
- `Post` 타입 사용 시작 (이번 단계에서 `model.ts`에 정의만 해 둠)
