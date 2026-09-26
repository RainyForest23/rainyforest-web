# Stage 3: 레거시 블로그 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 github.io 블로그의 글 18개를 `content/legacy/`로 한 번 옮기고, `/blog`, 글 상세, 태그 인덱스, RSS, sitemap을 로컬에서 완성한다.

**Architecture:** 레거시 글은 1회성 스크립트로 변환해 커밋하고, 이후에는 `lib/content/adapters/legacy.ts`가 `Post`로 읽는다(스펙 §4.1·§4.3). 본문은 프로젝트와 같은 MDX 파이프라인으로 렌더링하되, 수식을 위해 `remark-math` + `rehype-katex`를 더한다. RSS와 sitemap은 static export에서 `force-static` Route Handler와 metadata route로 빌드 시 파일로 만든다.

**Tech Stack:** Next.js 16 App Router(static export), next-mdx-remote-client, remark-gfm, remark-math, rehype-katex, gray-matter, Vitest

**Spec:** `docs/superpowers/specs/2026-09-19-personal-site-design.md` (§4.1 `Post`, §4.3, §4.4, §5, §9, §10 3단계)

## Global Constraints

Stage 1·2 계획서의 Global Constraints를 그대로 따른다. 이번 단계에서 추가되는 것:

- **Next 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 먼저 읽는다** (레포 `AGENTS.md`). 이 계획서의 Route Handler·sitemap 규칙은 그 문서 기준이다.
- 레거시 원본은 `~/Desktop/github/Rainyforest23.github.io`이며 **읽기 전용**이다.
- 변환 스크립트는 커밋하지 않는다(스펙 §4.3). 결과물(`content/legacy/*.mdx`, `content/legacy/redirects.json`, `public/blog/**`)만 커밋한다.
- slug와 태그는 `^[a-z0-9]+(?:-[a-z0-9]+)*$`만 허용한다. 한글·대문자·공백이 URL 경로에 들어가지 않는다.
- 날짜는 `YYYY-MM-DD` 문자열이다.
- 사이트 문구(UI)는 영문이다. 글 본문은 원문 언어 그대로 두고, 한국어 글에는 영문 요약(`summaryEn`)을 붙인다(스펙 D5).
- 절대 URL이 필요한 곳(RSS, sitemap)은 `lib/site.ts`의 `siteUrl()` 하나만 쓴다. 도메인은 코드에 쓰지 않는다.

## 이번 단계의 결정 (계획 중 확정)

| 결정 | 이유 |
|---|---|
| 24개 중 **테스트 글 6개는 옮기지 않는다** (`컴퓨터구조2`, `시소실테스트1`, `자료구조자바테스트1`, `자바랭테스트`, `두더지도사님을아세요?`, `markdown`) | 본문이 `# 테스트` 한 줄이거나 마크다운 문법 연습이다. 옛 URL은 `redirects.json`에서 `/blog/`로 보낸다 |
| 카테고리를 태그로 합친다 | 모델에 카테고리가 없다(스펙 §4.1). 태그 하나로 탐색한다 |
| 태그를 ASCII kebab-case로 정규화한다 | 54개 중 15개가 한글이다. 영문 우선 사이트이고, 한글 경로는 S3·CloudFront 인코딩 위험이 있다 |
| 옛 URL은 프론트매터가 아니라 `content/legacy/redirects.json` 한 파일에 모은다 | 7단계의 github.io 리다이렉트 스텁이 이 파일만 읽으면 된다 |
| 링크 검사는 lychee 대신 자체 스크립트로 한다(스펙 §9 변경) | 우리 CloudFront 함수의 경로 규칙(`/x/` → `/x/index.html`)을 그대로 흉내 내야 하고, 도구 체인을 하나로 유지한다 |
| 목차(TOC)는 이번 단계에 만들지 않는다 | 원본은 `toc: true`였지만 스펙에 없다. 디자인 세션에서 판단한다 |

## 사용자 확인이 필요한 내용 (공개 전, 7단계 이전까지)

- **캡스톤 논문 게재처 불일치.** `energy-attribution-model` 영·국문 글 첫머리는 "IEEE Internet of Things Journal (IoTJ) 2025"라고 적고, `content/resume.json`은 같은 제목을 "Mathematics, MDPI (SCIE), Submitted Feb 2026"으로 적는다. 변환 시 문장은 원문 그대로 두고, 사용자가 정한 쪽으로 나중에 고친다.

## Review Focus

테스트가 자연스럽게 다루지 않지만 실제로 사람을 물 가능성이 큰 입력:

1. **달러 기호가 가격으로 두 번 나오는 문단** (`$0.023/GB ... $0.0125/GB`)이 수식으로 렌더링된다. 기대: 이스케이프된 `\$`는 텍스트로 남고, `$w_i$`만 수식이 된다. → Task 3에 테스트.
2. **제목·요약의 `&`, `<`, `"`** 가 RSS XML을 깨뜨린다. 기대: 이스케이프되어 유효한 XML이 된다. → Task 5에 테스트.
3. **따옴표 없는 YAML 날짜**(`date: 2026-05-06`)를 gray-matter가 `Date` 객체로 바꿔, 정렬·표시가 틀어진다. 기대: `'2026-05-06'` 문자열로 정규화된다. → Task 1에 테스트.
4. **본문이 참조하는 이미지를 복사하지 않음.** 기대: 빌드가 파일명을 짚으며 실패한다. → Task 1에 테스트.
5. **`SITE_URL` 없이 배포 빌드**를 해서 sitemap·RSS에 `localhost`가 박힌다. 기대: 배포 후 스모크가 실패한다. → Task 5에서 `smoke.sh`에 검사 추가.

## File Structure

```
content/legacy/
├─ *.mdx                  변환된 글 18개 (고정)
└─ redirects.json         옛 github.io 경로 → 새 경로
public/blog/<slug>/*.png  글 이미지
lib/
├─ site.ts                siteUrl() — 절대 URL의 유일한 출처
├─ content/
│   ├─ model.ts           (기존) Post 타입 사용 시작
│   ├─ adapters/legacy.ts MDX → Post
│   ├─ validate.ts        (기존) validatePosts, findMissingAssets 추가
│   ├─ posts.ts           loadPosts / getPost / tagIndex
│   └─ mdx.ts             MDX 옵션 공유 (Prose와 테스트가 같은 설정을 쓴다)
└─ feed.ts                buildRss() — 순수 함수
app/
├─ blog/page.tsx
├─ blog/[slug]/page.tsx
├─ blog/tags/[tag]/page.tsx
├─ feed.xml/route.ts
└─ sitemap.ts
scripts/check-links.ts    out/ 내부 링크 검사
```

---

### Task 1: 레거시 어댑터와 글 검증

**Files:**
- Create: `lib/content/adapters/legacy.ts`
- Modify: `lib/content/validate.ts` (함수 추가)
- Test: `lib/content/adapters/legacy.test.ts`, `lib/content/validate-posts.test.ts`

**Interfaces:**
- Consumes: `Post`(`lib/content/model.ts`, 2단계에서 정의됨)
- Produces: `parseLegacyPost(fileName: string, raw: string): Post`
- Produces: `validatePosts(posts: Post[]): string[]`
- Produces: `findMissingAssets(posts: Post[], exists: (publicPath: string) => boolean): string[]` — 본문의 `](/blog/...)` 이미지 경로 중 `public/`에 없는 것을 반환한다. `exists`를 주입받아 파일시스템 없이 테스트한다.
- 레거시 글의 `outgoing`은 빈 배열이다. wikilink 그래프는 4단계 볼트 글에서 생긴다.

- [ ] **Step 1: 의존성 확인**

`gray-matter`는 2단계에서 설치됐다. 추가 설치는 없다.

- [ ] **Step 2: 실패하는 테스트 작성**

`lib/content/adapters/legacy.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseLegacyPost } from './legacy'

const raw = `---
title: "EC2 기초 정리"
summary_en: EC2 purchase options and instance families, summarised for the SAA exam.
lang: ko
date: 2026-05-06
updated: "2026-05-20"
tags: [aws, aws-saa, ec2]
---

## 구매 옵션

본문.
`

describe('parseLegacyPost', () => {
  it('takes the slug from the file name', () => {
    expect(parseLegacyPost('saa-ec2-basics.mdx', raw).slug).toBe('saa-ec2-basics')
  })

  it('maps frontmatter to the Post contract', () => {
    const post = parseLegacyPost('saa-ec2-basics.mdx', raw)
    expect(post.title).toBe('EC2 기초 정리')
    expect(post.summaryEn).toBe('EC2 purchase options and instance families, summarised for the SAA exam.')
    expect(post.lang).toBe('ko')
    expect(post.tags).toEqual(['aws', 'aws-saa', 'ec2'])
    expect(post.source).toBe('legacy')
    expect(post.outgoing).toEqual([])
  })

  it('normalises an unquoted YAML date, which gray-matter parses as a Date', () => {
    const post = parseLegacyPost('saa-ec2-basics.mdx', raw)
    expect(post.date).toBe('2026-05-06')
    expect(post.updated).toBe('2026-05-20')
  })

  it('keeps the body without frontmatter', () => {
    const post = parseLegacyPost('saa-ec2-basics.mdx', raw)
    expect(post.body.trim().startsWith('## 구매 옵션')).toBe(true)
  })
})
```

`lib/content/validate-posts.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Post } from './model'
import { findMissingAssets, validatePosts } from './validate'

function post(overrides: Partial<Post>): Post {
  return {
    slug: 'a',
    title: 'Title',
    summaryEn: 'Summary.',
    lang: 'ko',
    date: '2026-05-06',
    tags: ['aws'],
    source: 'legacy',
    body: '',
    outgoing: [],
    ...overrides,
  }
}

describe('validatePosts', () => {
  it('accepts a well-formed set', () => {
    expect(validatePosts([post({ slug: 'a' }), post({ slug: 'b' })])).toEqual([])
  })

  it('rejects duplicate slugs', () => {
    expect(validatePosts([post({}), post({})]).join(' ')).toContain('duplicate slug')
  })

  it('rejects a missing English summary', () => {
    expect(validatePosts([post({ summaryEn: '' })]).join(' ')).toContain('summary_en')
  })

  it('rejects slugs and tags that are not lowercase ASCII kebab-case', () => {
    expect(validatePosts([post({ slug: 'TAadministration' })]).join(' ')).toContain('slug')
    expect(validatePosts([post({ tags: ['코드트리'] })]).join(' ')).toContain('tag')
    expect(validatePosts([post({ tags: ['AI Workload'] })]).join(' ')).toContain('tag')
  })

  it('rejects dates that are not YYYY-MM-DD', () => {
    expect(validatePosts([post({ date: 'May 6, 2026' })]).join(' ')).toContain('date')
  })

  it('rejects an unknown language', () => {
    expect(validatePosts([post({ lang: 'jp' as Post['lang'] })]).join(' ')).toContain('lang')
  })
})

describe('findMissingAssets', () => {
  const body = 'Text\n\n![Figure 1](/blog/energy-attribution-model/fig1.png)\n\n![Figure 2](/blog/energy-attribution-model/fig2.png)'

  it('reports images the body references but public/ does not have', () => {
    const exists = (p: string) => p === '/blog/energy-attribution-model/fig1.png'
    expect(findMissingAssets([post({ slug: 'energy-attribution-model', body })], exists)).toEqual([
      'blog/energy-attribution-model: missing image /blog/energy-attribution-model/fig2.png',
    ])
  })

  it('ignores external images', () => {
    const external = post({ body: '![x](https://example.com/x.png)' })
    expect(findMissingAssets([external], () => false)).toEqual([])
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/content/adapters/legacy.test.ts lib/content/validate-posts.test.ts`
Expected: FAIL. `./legacy`를 찾을 수 없고, `validatePosts`·`findMissingAssets`가 export되지 않았다는 오류.

- [ ] **Step 4: 어댑터 구현**

`lib/content/adapters/legacy.ts`:
```ts
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
```

- [ ] **Step 5: 검증 함수 추가**

`lib/content/validate.ts` 끝에 덧붙인다(기존 `validateProjects`는 그대로 둔다):
```ts
import type { Post } from './model'

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const LANGS = ['ko', 'en'] as const

export function validatePosts(posts: Post[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const p of posts) {
    const where = `blog/${p.slug}`
    if (seen.has(p.slug)) errors.push(`${where}: duplicate slug`)
    seen.add(p.slug)

    if (!KEBAB.test(p.slug)) errors.push(`${where}: slug must be lowercase ASCII kebab-case`)
    if (!p.title) errors.push(`${where}: title is required`)
    if (!p.summaryEn) errors.push(`${where}: summary_en is required`)
    if (!LANGS.includes(p.lang)) errors.push(`${where}: lang must be one of ${LANGS.join(', ')}`)
    if (!ISO_DATE.test(p.date)) errors.push(`${where}: date must be YYYY-MM-DD`)
    if (p.updated && !ISO_DATE.test(p.updated)) errors.push(`${where}: updated must be YYYY-MM-DD`)
    for (const tag of p.tags) {
      if (!KEBAB.test(tag)) errors.push(`${where}: tag "${tag}" must be lowercase ASCII kebab-case`)
    }
  }
  return errors
}

const LOCAL_IMAGE = /!\[[^\]]*\]\((\/[^)\s]+)\)/g

export function findMissingAssets(posts: Post[], exists: (publicPath: string) => boolean): string[] {
  return posts.flatMap((p) =>
    [...p.body.matchAll(LOCAL_IMAGE)]
      .map((m) => m[1])
      .filter((path) => !exists(path))
      .map((path) => `blog/${p.slug}: missing image ${path}`),
  )
}
```

`import type { Post }`는 파일 맨 위의 기존 import 줄과 합친다: `import { PROJECT_CATEGORIES, type Post, type Project } from './model'`.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run lib/content`
Expected: PASS. 새 테스트 12개와 2단계의 기존 테스트가 모두 통과한다.

- [ ] **Step 7: Commit**

```bash
npm run verify
git add lib/content
git commit -m "feat: parse and validate legacy blog posts"
```

---

### Task 2: 레거시 글 18개 변환

**Files:**
- Create: `content/legacy/*.mdx` (18개), `content/legacy/redirects.json`, `public/blog/<slug>/*.png`

**Interfaces:**
- Consumes: Task 1의 `parseLegacyPost`, `validatePosts`, `findMissingAssets`
- Produces: `content/legacy/redirects.json` — `{ "<옛 경로>": "<새 경로>" }`. 옛 경로는 github.io 사이트맵의 경로(퍼센트 인코딩 그대로, 끝 슬래시 포함), 새 경로는 `/blog/<slug>/` 또는 `/blog/`. 7단계가 이 파일로 github.io 스텁을 만든다.

- [ ] **Step 1: slug 확정**

| 원본 (`_posts/...`) | slug | lang |
|---|---|---|
| `Cloud/ACC-AWS-handson/2026-03-31-aws-network-concepts.md` | `aws-network-concepts` | ko |
| `Cloud/ACC-AWS-handson/2026-04-07-aws-storage-concepts.md` | `aws-storage-concepts` | ko |
| `Cloud/ACC-AWS-handson/2026-04-14-aws-database-concepts.md` | `aws-database-concepts` | ko |
| `Cloud/SAA/2026-05-06-ec2-basics.md` | `saa-ec2-basics` | ko |
| `Cloud/SAA/2026-05-06-iam.md` | `saa-iam` | ko |
| `Cloud/SAA/2026-05-06-saa-s3-practice.md` | `saa-s3-practice` | ko |
| `Cloud/SAA/2026-05-20-saa-s3-storage-database-compute.md` | `saa-s3-storage-database-compute` | ko |
| `DataStructure/dsC/2024-09-06-자료구조C.md` | `data-structures-in-c` | ko |
| `Physical AI/2026-05-10-isaac-sim-webrtc-troubleshooting.md` | `isaac-sim-webrtc-troubleshooting` | ko |
| `PJT/Capstone/2024-12-01-vm-energy-measurement-research.md` | `vm-energy-measurement-research` | ko |
| `PJT/Capstone/2025-05-25-energy-attribution-model-en.md` | `energy-attribution-model` | en |
| `PJT/Capstone/2025-05-25-energy-attribution-model-ko.md` | `energy-attribution-model-ko` | ko |
| `PJT/Forest/2024-09-04-TAadministration.md` | `ta-administration` | ko |
| `PS/2026-05-06-codetree-week1.md` | `codetree-week-1` | ko |
| `PS/2026-05-23-codetree-week3.md` | `codetree-week-3` | ko |
| `PS/2026-06-01-codetree-week4.md` | `codetree-week-4` | ko |
| `PS/2026-06-08-codetree-week5.md` | `codetree-week-5` | ko |
| `PS/2026-06-22-codetree-gapcheck-midpoint.md` | `codetree-gap-check-midpoint` | ko |

캡스톤 글은 영문판이 정식 slug(`energy-attribution-model`)를 가진다. 영문 우선 사이트이기 때문이다(스펙 D5).

- [ ] **Step 2: 변환 스크립트 작성과 실행 (커밋하지 않음)**

스크래치패드에 `convert_legacy.py`를 만든다. 레포에 두지 않는다.

```python
import json, pathlib, re, shutil, urllib.parse, urllib.request

SRC = pathlib.Path.home() / 'Desktop/github/Rainyforest23.github.io'
OUT = pathlib.Path('content/legacy')
PUB = pathlib.Path('public/blog')

SLUGS = {  # source stem -> (slug, lang)
    '2026-03-31-aws-network-concepts': ('aws-network-concepts', 'ko'),
    '2026-04-07-aws-storage-concepts': ('aws-storage-concepts', 'ko'),
    '2026-04-14-aws-database-concepts': ('aws-database-concepts', 'ko'),
    '2026-05-06-ec2-basics': ('saa-ec2-basics', 'ko'),
    '2026-05-06-iam': ('saa-iam', 'ko'),
    '2026-05-06-saa-s3-practice': ('saa-s3-practice', 'ko'),
    '2026-05-20-saa-s3-storage-database-compute': ('saa-s3-storage-database-compute', 'ko'),
    '2024-09-06-자료구조C': ('data-structures-in-c', 'ko'),
    '2026-05-10-isaac-sim-webrtc-troubleshooting': ('isaac-sim-webrtc-troubleshooting', 'ko'),
    '2024-12-01-vm-energy-measurement-research': ('vm-energy-measurement-research', 'ko'),
    '2025-05-25-energy-attribution-model-en': ('energy-attribution-model', 'en'),
    '2025-05-25-energy-attribution-model-ko': ('energy-attribution-model-ko', 'ko'),
    '2024-09-04-TAadministration': ('ta-administration', 'ko'),
    '2026-05-06-codetree-week1': ('codetree-week-1', 'ko'),
    '2026-05-23-codetree-week3': ('codetree-week-3', 'ko'),
    '2026-06-01-codetree-week4': ('codetree-week-4', 'ko'),
    '2026-06-08-codetree-week5': ('codetree-week-5', 'ko'),
    '2026-06-22-codetree-gapcheck-midpoint': ('codetree-gap-check-midpoint', 'ko'),
}

# Legacy categories and tags -> normalised tags. None drops the tag.
TAGS = {
    'Cloud': 'cloud', 'ACC-AWS-handson': 'aws-hands-on', 'SAA': 'aws-saa', 'AWS': 'aws',
    'Physical AI': 'physical-ai', 'PJT': None, 'Capstone': 'capstone', 'Forest': 'sdij-forest',
    'dsC': 'data-structures', 'PS': 'problem-solving',
    'AI Workload': 'ai-workload', 'Energy Attribution': 'energy-attribution',
    'Energy Measurement': 'energy-measurement', 'Edge Computing': 'edge-computing',
    'IoTJ': None, 'Isaac Sim': 'isaac-sim', 'NAT Gateway': 'nat-gateway',
    'Bastion Host': 'bastion-host', 'Route53': 'route-53',
    '코드트리': 'codetree', '갭체크': 'codetree', '코딩테스트': 'coding-test', '코테공부': 'coding-test',
    '코딩테스트준비': 'coding-test', '스토리지': 'storage', '수명주기': 'lifecycle',
    '알고리즘': 'algorithms', '알고리즘기초': 'algorithms', '루틴': 'study-routine',
    '복습': 'study-routine', '오답노트': 'study-routine', '깃허브': 'github', '북마크': None,
    '개발자취업': 'career',
}

def norm_tag(t):
    t = t.strip().strip('"\'')
    if t in TAGS: return TAGS[t]
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')

def old_paths():
    """Old github.io paths, read from the live sitemap."""
    xml = urllib.request.urlopen('https://rainyforest23.github.io/sitemap.xml').read().decode()
    return [re.sub(r'^https://rainyforest23\.github\.io', '', u) for u in re.findall(r'<loc>([^<]+)</loc>', xml)]

OLD = old_paths()
def old_for(stem):
    name = re.sub(r'^\d{4}-\d{2}-\d{2}-', '', stem)
    enc = urllib.parse.quote(name)
    hits = [p for p in OLD if p.rstrip('/').endswith('/' + enc) or p.rstrip('/').endswith('/' + name)]
    return hits[0] if hits else None

redirects, link_map = {}, {}
for stem, (slug, _) in SLUGS.items():
    p = old_for(stem)
    if p: redirects[p] = f'/blog/{slug}/'; link_map[urllib.parse.unquote(p)] = f'/blog/{slug}/'
for p in OLD:  # everything else that was a post (test posts) goes to the blog index
    if p.count('/') >= 3 and p not in redirects and not p.startswith(('/categories', '/page')):
        redirects[p] = '/blog/'

OUT.mkdir(parents=True, exist_ok=True)
for src in SRC.glob('_posts/**/*.md'):
    if src.stem not in SLUGS: continue
    slug, lang = SLUGS[src.stem]
    _, fm, body = src.read_text(encoding='utf-8').split('---', 2)

    title = re.search(r'^title:\s*"?(.*?)"?\s*$', fm, re.M).group(1)
    date = src.stem[:10]
    upd = re.search(r'^last_modified_at:\s*(\S+)', fm, re.M)
    raw_tags = []
    cats = re.search(r'^categories:\s*\[?(.*?)\]?\s*$', fm, re.M)
    if cats: raw_tags += cats.group(1).split(',')
    block = re.search(r'^tags:\s*\n((?:\s+-.*\n?)+)', fm, re.M)
    if block: raw_tags += re.findall(r'-\s*(.+)', block.group(1))
    tags = sorted({t for t in (norm_tag(x) for x in raw_tags) if t})

    # Images: copy next to the post and point at the new location.
    def move_image(m):
        alt, path = m.group(1), m.group(2)
        src_img = SRC / path.lstrip('/')
        dest = PUB / slug / src_img.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src_img, dest)
        return f'![{alt}](/blog/{slug}/{src_img.name})'
    body = re.sub(r'!\[([^\]]*)\]\((/(?:image|assets/images)/[^)]+)\)', move_image, body)

    # Old internal links -> new blog paths.
    for old, new in link_map.items():
        body = body.replace(f']({old})', f']({new})')

    # A lone "$" used as currency must not start inline math.
    body = re.sub(r'(?<![\\$])\$(?=/hr)', r'\\$', body)

    # MDX treats a bare "<" as JSX.
    body = re.sub(r'<(?=[^a-zA-Z/!])', r'\\<', body)
    body = body.replace('<br>', '<br />')

    front = [
        f'title: {json.dumps(title, ensure_ascii=False)}',
        'summary_en: ""',
        f'lang: {lang}',
        f'date: "{date}"',
    ]
    if upd: front.append(f'updated: "{upd.group(1)}"')
    front.append(f'tags: [{", ".join(tags)}]')
    (OUT / f'{slug}.mdx').write_text('---\n' + '\n'.join(front) + '\n---\n\n' + body.strip() + '\n', encoding='utf-8')

(OUT / 'redirects.json').write_text(json.dumps(dict(sorted(redirects.items())), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('posts:', len(list(OUT.glob('*.mdx'))), 'redirects:', len(redirects))
```

레포 루트에서 실행한다:
```bash
python3 <scratchpad>/convert_legacy.py
```
Expected: `posts: 18 redirects: 24`.

- [ ] **Step 3: 영문 요약 작성**

각 파일의 `summary_en: ""`를 채운다. 스크립트로 만들지 않고 글을 읽고 쓴다. 규칙:

- 영어 한 문장, 25단어 이내. 무엇을 다루는지와 독자가 얻는 것을 쓴다.
- 판매 문구를 쓰지 않는다("comprehensive", "deep dive" 금지).
- `energy-attribution-model`(영문판)도 요약을 쓴다. 목록 페이지가 모든 글에 요약을 보여주기 때문이다.

- [ ] **Step 4: 변환 결과 검증**

```bash
npx tsx -e "
import('./lib/content/adapters/legacy.ts').then(async ({ parseLegacyPost }) => {
  const { readdirSync, readFileSync, existsSync } = await import('node:fs')
  const { validatePosts, findMissingAssets } = await import('./lib/content/validate.ts')
  const posts = readdirSync('content/legacy').filter(f => f.endsWith('.mdx'))
    .map(f => parseLegacyPost(f, readFileSync('content/legacy/' + f, 'utf8')))
  const errors = [...validatePosts(posts), ...findMissingAssets(posts, p => existsSync('public' + p))]
  console.log('posts:', posts.length, '| errors:', errors.length)
  errors.forEach(e => console.log('  ' + e))
  const tags = new Map()
  posts.forEach(p => p.tags.forEach(t => tags.set(t, (tags.get(t) ?? 0) + 1)))
  console.log('tags:', [...tags].sort((a, b) => b[1] - a[1]).map(([t, n]) => t + '(' + n + ')').join(' '))
})"
```
Expected: `posts: 18 | errors: 0`. 태그 목록에 한글·대문자가 없다.

`grep -c '/pjt/capstone' content/legacy/*.mdx`가 모두 0이어야 한다. 옛 내부 링크가 남으면 `link_map` 매칭이 실패한 것이다.

- [ ] **Step 5: Commit**

```bash
git add content/legacy public/blog
git commit -m "feat: migrate eighteen posts from the github.io blog"
```

---

### Task 3: 수식을 포함한 MDX 파이프라인

**Files:**
- Create: `lib/content/mdx.ts`
- Modify: `components/site/prose.tsx`, `app/layout.tsx`
- Test: `lib/content/mdx.test.ts`

**Interfaces:**
- Produces: `mdxOptions` — `{ remarkPlugins, rehypePlugins }`. `Prose`와 테스트가 같은 객체를 쓴다. 테스트와 실제 렌더링의 설정이 어긋나지 않게 하기 위해서다.

- [ ] **Step 1: 의존성 설치**

```bash
npm install remark-math@6 rehype-katex@7 katex@0
npm install -D @mdx-js/mdx@3
```

`@mdx-js/mdx`는 테스트에서 MDX를 HTML로 컴파일하는 데만 쓴다. `next-mdx-remote-client`도 내부적으로 같은 컴파일러를 쓴다.

- [ ] **Step 2: 실패하는 테스트 작성**

`lib/content/mdx.test.ts`:
```ts
import { evaluate } from '@mdx-js/mdx'
import { createElement } from 'react'
import * as runtime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { mdxOptions } from './mdx'

async function render(source: string): Promise<string> {
  const { default: Content } = await evaluate(source, { ...runtime, ...mdxOptions })
  return renderToStaticMarkup(createElement(Content))
}

describe('mdxOptions', () => {
  it('renders inline math with KaTeX', async () => {
    expect(await render('Then, for each workload $w_i$:')).toContain('class="katex"')
  })

  it('renders block math whose braces would otherwise be JSX expressions', async () => {
    const html = await render('$$E^{sys} = \\sum_{i=1}^{n} E_{w_i}$$')
    expect(html).toContain('katex-display')
  })

  it('keeps escaped dollar signs as prices, not math', async () => {
    const html = await render('Standard costs \\$0.023/GB and Infrequent Access \\$0.0125/GB.')
    expect(html).not.toContain('katex')
    expect(html).toContain('$0.023/GB')
    expect(html).toContain('$0.0125/GB')
  })

  it('renders GFM tables', async () => {
    expect(await render('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table>')
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/content/mdx.test.ts`
Expected: FAIL. `./mdx`를 찾을 수 없다.

- [ ] **Step 4: 공유 옵션 구현**

`lib/content/mdx.ts`:
```ts
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

/**
 * One MDX configuration for every page and for the tests.
 * remark-gfm: tables, strikethrough, autolinks. remark-math + rehype-katex: $inline$ and $$block$$ math.
 * A literal dollar sign in prose must be written as \$.
 */
export const mdxOptions = {
  remarkPlugins: [remarkGfm, remarkMath],
  rehypePlugins: [rehypeKatex],
}
```

`components/site/prose.tsx`를 바꾼다:
```tsx
import { MDXRemote } from 'next-mdx-remote-client/rsc'
import { mdxOptions } from '@/lib/content/mdx'

export function Prose({ source }: { source: string }) {
  return (
    <div className="prose-body">
      <MDXRemote source={source} options={{ mdxOptions }} />
    </div>
  )
}
```

`app/layout.tsx`의 `import './globals.css'` 바로 위에 추가한다:
```ts
import 'katex/dist/katex.min.css'
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run lib/content/mdx.test.ts`
Expected: PASS, 4개.

`react-dom/server`가 Vitest 환경에서 `TextEncoder` 관련 오류를 내면 `vitest.config.ts`의 `test`에 `environment: 'node'`가 명시돼 있는지 확인한다(기본값이 node다).

- [ ] **Step 6: Commit**

```bash
npm run verify
git add lib/content/mdx.ts lib/content/mdx.test.ts components/site/prose.tsx app/layout.tsx package.json package-lock.json
git commit -m "feat: share one MDX pipeline with math support across pages and tests"
```

---

### Task 4: 블로그 페이지

**Files:**
- Create: `lib/content/posts.ts`, `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `app/blog/tags/[tag]/page.tsx`, `components/site/post-list.tsx`
- Modify: `components/site/site-header.tsx`
- Test: `lib/content/posts.test.ts`

**Interfaces:**
- Consumes: `parseLegacyPost`, `validatePosts`, `findMissingAssets`(Task 1), `Prose`(Task 3)
- Produces: `loadPosts(): Post[]`(날짜 역순), `getPost(slug: string): Post | undefined`, `tagIndex(posts: Post[]): Map<string, Post[]>`(태그 이름순, 각 목록은 날짜 역순), `formatDate(iso: string): string`(`2026-05-06` → `May 6, 2026`)

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/content/posts.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Post } from './model'
import { formatDate, loadPosts, sortPosts, tagIndex } from './posts'

function post(slug: string, date: string, tags: string[]): Post {
  return { slug, title: slug, summaryEn: 's', lang: 'ko', date, tags, source: 'legacy', body: '', outgoing: [] }
}

describe('sortPosts', () => {
  it('orders posts newest first', () => {
    const sorted = sortPosts([post('old', '2024-09-04', []), post('new', '2026-06-22', [])])
    expect(sorted.map((p) => p.slug)).toEqual(['new', 'old'])
  })
})

describe('tagIndex', () => {
  it('groups posts by tag, tags alphabetical, posts newest first', () => {
    const index = tagIndex([
      post('a', '2026-01-01', ['aws', 'cloud']),
      post('b', '2026-02-01', ['aws']),
    ])
    expect([...index.keys()]).toEqual(['aws', 'cloud'])
    expect(index.get('aws')?.map((p) => p.slug)).toEqual(['b', 'a'])
  })
})

describe('formatDate', () => {
  it('formats an ISO date in English without timezone drift', () => {
    expect(formatDate('2026-05-06')).toBe('May 6, 2026')
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026')
  })
})

describe('loadPosts', () => {
  it('loads every migrated post and passes validation', () => {
    const posts = loadPosts()
    expect(posts.length).toBe(18)
    expect(posts[0].date >= posts[posts.length - 1].date).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/content/posts.test.ts`
Expected: FAIL. `./posts`를 찾을 수 없다.

- [ ] **Step 3: 로더 구현**

`lib/content/posts.ts`:
```ts
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
```

Run: `npx vitest run lib/content/posts.test.ts` → PASS, 4개.

- [ ] **Step 4: 목록 컴포넌트**

`components/site/post-list.tsx`:
```tsx
import Link from 'next/link'
import type { Post } from '@/lib/content/model'
import { formatDate } from '@/lib/content/posts'

export function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.slug} className="border-t border-line py-5 first:border-t-0 first:pt-0">
          <p className="text-sm text-fg-muted">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.lang === 'ko' ? ' — in Korean' : ''}
          </p>
          <h3 className="mt-1 text-lg font-semibold">
            <Link href={`/blog/${post.slug}/`} className="hover:underline">
              {post.title}
            </Link>
          </h3>
          <p className="mt-1 text-fg-muted">{post.summaryEn}</p>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 5: 목록 페이지**

`app/blog/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { PostList } from '@/components/site/post-list'
import { loadPosts, tagIndex } from '@/lib/content/posts'

export const metadata: Metadata = {
  title: 'Blog — Woorim Shin',
  description: 'Notes on cloud infrastructure, AI systems and problem solving.',
}

export default function BlogPage() {
  const posts = loadPosts()
  const tags = [...tagIndex(posts)]
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Blog</h1>
      <p className="mt-2 text-fg-muted">
        Most posts are in Korean, each with an English summary.{' '}
        <a href="/feed.xml" className="underline">RSS</a>
      </p>
      <div className="mt-10">
        <PostList posts={posts} />
      </div>
      <h2 className="mt-16 text-sm font-semibold text-fg-muted">Tags</h2>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {tags.map(([tag, tagged]) => (
          <Link key={tag} href={`/blog/tags/${tag}/`} className="hover:underline">
            {tag} ({tagged.length})
          </Link>
        ))}
      </p>
    </main>
  )
}
```

- [ ] **Step 6: 글 상세 페이지**

`app/blog/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Prose } from '@/components/site/prose'
import { formatDate, getPost, loadPosts } from '@/lib/content/posts'

export function generateStaticParams() {
  return loadPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return { title: `${post.title} — Woorim Shin`, description: post.summaryEn }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm text-fg-muted">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        {post.updated && post.updated !== post.date ? ` — updated ${formatDate(post.updated)}` : ''}
      </p>
      <h1 className="mt-2 text-3xl font-semibold">{post.title}</h1>
      {post.lang === 'ko' ? (
        <p className="mt-4 border-l-2 border-line pl-4 text-fg-muted">
          <span className="font-medium">In English:</span> {post.summaryEn}
        </p>
      ) : null}
      <p className="mt-4 flex flex-wrap gap-x-3 text-sm">
        {post.tags.map((tag) => (
          <Link key={tag} href={`/blog/tags/${tag}/`} className="text-fg-muted hover:underline">
            #{tag}
          </Link>
        ))}
      </p>
      <article className="mt-10" lang={post.lang}>
        <Prose source={post.body} />
      </article>
    </main>
  )
}
```

`<article lang>`은 한국어 본문을 스크린리더와 브라우저 하이픈 처리가 한국어로 다루게 한다.

- [ ] **Step 7: 태그 페이지**

`app/blog/tags/[tag]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PostList } from '@/components/site/post-list'
import { loadPosts, tagIndex } from '@/lib/content/posts'

export function generateStaticParams() {
  return [...tagIndex(loadPosts()).keys()].map((tag) => ({ tag }))
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params
  return { title: `#${tag} — Woorim Shin` }
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const posts = tagIndex(loadPosts()).get(tag)
  if (!posts) notFound()

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">#{tag}</h1>
      <p className="mt-2 text-fg-muted">
        {posts.length} {posts.length === 1 ? 'post' : 'posts'}
      </p>
      <div className="mt-10">
        <PostList posts={posts} />
      </div>
    </main>
  )
}
```

- [ ] **Step 8: 헤더에 Blog 추가**

`components/site/site-header.tsx`의 `NAV`를 바꾼다:
```ts
const NAV = [
  { href: '/cv/', label: 'CV' },
  { href: '/projects/', label: 'Projects' },
  { href: '/blog/', label: 'Blog' },
]
```

- [ ] **Step 9: 빌드와 눈으로 확인**

```bash
npm run build
ls out/blog/index.html out/blog/energy-attribution-model/index.html out/blog/tags/aws/index.html
grep -o 'class="katex' out/blog/energy-attribution-model/index.html | wc -l
```
Expected: 세 파일이 존재하고, 캡스톤 영문 글에 KaTeX 요소가 1개 이상 있다.

`npm run dev`로 확인할 것: 캡스톤 글의 수식과 그림 8개, `saa-ec2-basics`의 `($/hr)`가 글자 그대로 보이는지, 코드 블록, 표, 모바일 폭에서 긴 수식이 가로로 넘치지 않는지(넘치면 `tokens.css`의 `.prose-body .katex-display`에 `overflow-x: auto`를 추가한다).

- [ ] **Step 10: Commit**

```bash
npm run verify
git add lib/content/posts.ts lib/content/posts.test.ts app/blog components/site
git commit -m "feat: add blog index, post and tag pages"
```

---

### Task 5: RSS와 sitemap

**Files:**
- Create: `lib/site.ts`, `lib/feed.ts`, `app/feed.xml/route.ts`, `app/sitemap.ts`
- Modify: `.github/workflows/deploy.yml`, `scripts/smoke.sh`
- Test: `lib/feed.test.ts`

**Interfaces:**
- Produces: `siteUrl(): string` — `SITE_URL` 환경변수(끝 슬래시 제거), 없으면 `http://localhost:3000`.
- Produces: `buildRss(input: { siteUrl: string; title: string; description: string; posts: Post[] }): string`
- Next 16 문서 근거: static export에서 Route Handler는 `export const dynamic = 'force-static'`이 있어야 빌드 시 생성된다(`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`의 Route Handlers 절). `sitemap.ts`도 특수 Route Handler이므로 같은 설정을 둔다.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/feed.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Post } from './content/model'
import { buildRss } from './feed'

const post: Post = {
  slug: 'saa-s3-practice',
  title: 'S3 & Glacier: <Lifecycle> "rules"',
  summaryEn: 'Storage classes & lifecycle rules, with prices < $0.01/GB.',
  lang: 'ko',
  date: '2026-05-06',
  tags: ['aws'],
  source: 'legacy',
  body: '',
  outgoing: [],
}

const xml = buildRss({ siteUrl: 'https://example.dev', title: 'Blog', description: 'Notes', posts: [post] })

describe('buildRss', () => {
  it('escapes XML special characters in titles and summaries', () => {
    expect(xml).toContain('<title>S3 &amp; Glacier: &lt;Lifecycle&gt; &quot;rules&quot;</title>')
    expect(xml).toContain('prices &lt; $0.01/GB')
    expect(xml).not.toMatch(/<title>[^<]*<Lifecycle>/)
  })

  it('uses absolute URLs built from the site URL', () => {
    expect(xml).toContain('<link>https://example.dev/blog/saa-s3-practice/</link>')
    expect(xml).toContain('<guid isPermaLink="true">https://example.dev/blog/saa-s3-practice/</guid>')
  })

  it('writes RFC 822 dates', () => {
    expect(xml).toContain('<pubDate>Wed, 06 May 2026 00:00:00 GMT</pubDate>')
  })

  it('is a single RSS 2.0 channel', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml.match(/<channel>/g)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/feed.test.ts`
Expected: FAIL. `./feed`를 찾을 수 없다.

- [ ] **Step 3: 구현**

`lib/site.ts`:
```ts
/** The only source of absolute URLs. Set SITE_URL in the deploy build. */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}
```

`lib/feed.ts`:
```ts
import type { Post } from './content/model'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c])

export function buildRss(input: { siteUrl: string; title: string; description: string; posts: Post[] }): string {
  const items = input.posts
    .map((p) => {
      const url = `${input.siteUrl}/blog/${p.slug}/`
      return [
        '    <item>',
        `      <title>${escapeXml(p.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(p.summaryEn)}</description>`,
        '    </item>',
      ].join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(input.title)}</title>`,
    `    <link>${input.siteUrl}/blog/</link>`,
    `    <description>${escapeXml(input.description)}</description>`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
```

Run: `npx vitest run lib/feed.test.ts` → PASS, 4개.

- [ ] **Step 4: Route Handler와 sitemap**

`app/feed.xml/route.ts`:
```ts
import { buildRss } from '@/lib/feed'
import { loadPosts } from '@/lib/content/posts'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export function GET() {
  const xml = buildRss({
    siteUrl: siteUrl(),
    title: 'Woorim Shin — Blog',
    description: 'Notes on cloud infrastructure, AI systems and problem solving.',
    posts: loadPosts(),
  })
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
```

`app/sitemap.ts`:
```ts
import type { MetadataRoute } from 'next'
import { loadPosts, tagIndex } from '@/lib/content/posts'
import { loadProjects } from '@/lib/content/projects'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const posts = loadPosts()
  return [
    ...['/', '/cv/', '/projects/', '/blog/'].map((path) => ({ url: `${base}${path}` })),
    ...loadProjects().map((p) => ({ url: `${base}/projects/${p.slug}/` })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}/`, lastModified: p.updated ?? p.date })),
    ...[...tagIndex(posts).keys()].map((tag) => ({ url: `${base}/blog/tags/${tag}/` })),
  ]
}
```

- [ ] **Step 5: 빌드 산출물 확인**

```bash
SITE_URL=https://example.dev npm run build
ls out/feed.xml out/sitemap.xml
grep -c '<item>' out/feed.xml
grep -o '<loc>[^<]*</loc>' out/sitemap.xml | head -3
grep -c 'localhost' out/sitemap.xml out/feed.xml
```
Expected: 두 파일이 있고, `<item>` 18개, `<loc>`이 `https://example.dev/`로 시작하며, `localhost`는 0건이다.

`out/feed.xml`이 아니라 `out/feed.xml/index.html` 같은 디렉터리가 생기면 `trailingSlash: true`와 충돌한 것이다. 이 경우 Next 문서의 static exports 절을 다시 확인하고, 필요하면 `app/feed.xml/route.ts`를 `app/rss/route.ts` + CloudFront 경로로 옮기는 대신 빌드 후 `mv`하지 말고 멈춰서 보고한다.

- [ ] **Step 6: 배포 빌드에 SITE_URL 주입, 스모크에 검사 추가**

`.github/workflows/deploy.yml`의 `deploy` 잡 `npm run build` 스텝 `env`에 추가한다:
```yaml
        env:
          BUILD_SHA: ${{ github.sha }}
          SITE_URL: https://${{ vars.SITE_DOMAIN }}
```

`scripts/smoke.sh`의 마지막 `echo` 위에 추가한다:
```bash
curl -fsS "https://$SITE_DOMAIN/sitemap.xml" | grep -qF "<loc>https://$SITE_DOMAIN/" \
  || fail "sitemap does not use https://$SITE_DOMAIN (was SITE_URL set for the build?)"
```

```bash
bash -n scripts/smoke.sh && echo syntax-ok
npx --yes @action-validator/cli .github/workflows/deploy.yml
```

- [ ] **Step 7: Commit**

```bash
npm run verify
git add lib/site.ts lib/feed.ts lib/feed.test.ts app/feed.xml app/sitemap.ts .github/workflows/deploy.yml scripts/smoke.sh
git commit -m "feat: generate RSS and sitemap at build time from one site URL"
```

---

### Task 6: 내부 링크 검사

**Files:**
- Create: `scripts/check-links.ts`
- Modify: `package.json` (`check:links` 스크립트, `verify`에 연결)
- Test: `scripts/check-links.test.ts`

**Interfaces:**
- Produces: `findBrokenLinks(pages: Map<string, string>, files: Set<string>): string[]` — `pages`는 `out/` 기준 HTML 경로 → 내용, `files`는 `out/` 안의 모든 파일 경로. 사이트 내부 링크(`href`·`src`가 `/`로 시작)만 검사한다.
- 경로 규칙은 CloudFront 함수(1단계 Task 3)와 같다: `/x/` → `x/index.html`, 확장자 없는 `/x` → `x/index.html`, 확장자 있는 경로는 그대로.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/check-links.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { findBrokenLinks } from './check-links'

const files = new Set(['index.html', 'blog/index.html', 'blog/a/index.html', 'blog/a/fig.png', 'feed.xml'])

describe('findBrokenLinks', () => {
  it('accepts links to existing pages and assets', () => {
    const pages = new Map([['index.html', '<a href="/blog/">b</a><a href="/blog/a/">a</a><img src="/blog/a/fig.png"><a href="/feed.xml">rss</a>']])
    expect(findBrokenLinks(pages, files)).toEqual([])
  })

  it('reports a link to a page that was not generated', () => {
    const pages = new Map([['blog/index.html', '<a href="/blog/missing/">x</a>']])
    expect(findBrokenLinks(pages, files)).toEqual(['blog/index.html -> /blog/missing/'])
  })

  it('resolves extensionless paths the way the CloudFront function does', () => {
    const pages = new Map([['index.html', '<a href="/blog/a">a</a>']])
    expect(findBrokenLinks(pages, files)).toEqual([])
  })

  it('ignores external links, anchors, mailto and query strings', () => {
    const pages = new Map([['index.html', '<a href="https://x.dev">x</a><a href="#top">t</a><a href="mailto:a@b.c">m</a><a href="/blog/?q=1">q</a>']])
    expect(findBrokenLinks(pages, files)).toEqual([])
  })

  it('ignores Next.js runtime assets, which are emitted separately', () => {
    const pages = new Map([['index.html', '<script src="/_next/static/chunks/x.js"></script>']])
    expect(findBrokenLinks(pages, files)).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run scripts/check-links.test.ts`
Expected: FAIL. `./check-links`를 찾을 수 없다.

- [ ] **Step 3: 구현**

`scripts/check-links.ts`:
```ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LINK = /(?:href|src)="(\/[^"#?]*)[^"]*"/g

/** Same resolution as infra/functions/viewer-request.js. */
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
```

Run: `npx vitest run scripts/check-links.test.ts` → PASS, 5개.

- [ ] **Step 4: verify에 연결**

`package.json`의 `scripts`를 바꾼다:
```json
"check:links": "tsx scripts/check-links.ts",
"verify": "npm run check:tokens && npm test && npm run build && npm run check:links && npm run typecheck"
```

- [ ] **Step 5: 실제 산출물 검사**

```bash
npm run build && npm run check:links
```
Expected: `check-links: ok (N pages)`. 깨진 링크가 나오면 대부분 레거시 본문의 옛 경로다. 원인을 고치고(`content/legacy/*.mdx`의 링크 수정) 검사를 느슨하게 만들지 않는다.

- [ ] **Step 6: Commit**

```bash
npm run verify
git add scripts/check-links.ts scripts/check-links.test.ts package.json
git commit -m "feat: fail the build on broken internal links"
```

---

## 3단계 완료 기준

- `npm run verify` 통과 (토큰 → 테스트 → 빌드 → 링크 → 타입)
- `/blog/`, 글 18개, 태그 페이지가 모두 정적 생성됨
- 캡스톤 글의 수식과 그림이 렌더링됨
- `out/feed.xml`, `out/sitemap.xml` 생성, `SITE_URL` 주입 시 `localhost` 0건
- `content/legacy/redirects.json`에 옛 github.io 경로 24개가 모두 있음
- 캡스톤 논문 게재처는 사용자 확인 대기로 남음 (7단계 전까지)

## 4단계에서 이어서 할 일

- 볼트 어댑터(`adapters/vault.ts`)와 wikilink 해석, `Post.outgoing` 채우기
- 백링크·로컬 그래프, `⌘K` 검색(Pagefind)
- 볼트 노트는 MDX 문법에 덜 통제된 텍스트다. 레거시처럼 1회 정리가 불가능하므로, 렌더링 형식(`format: 'md'` 등)을 4단계 계획에서 결정한다
- 프로젝트 상세의 "Notes & logs"(`Post.project` 역참조)
