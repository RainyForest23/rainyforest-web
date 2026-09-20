# 개인 사이트 통합 설계 (CV + 포트폴리오 + Obsidian 연동 블로그)

- 작성일: 2026-09-19
- 상태: 설계 확정, 구현 계획 작성 전
- 판단 기준: **장기 유지보수 용이성**. 선택지가 갈리면 운영할 코드·설정이 적은 쪽을 고른다.

## 1. 목표와 범위

두 Jekyll 사이트를 하나의 풀스택 웹사이트로 통합해 자체 도메인에 배포한다.

| 현재 | 테마 | 콘텐츠 |
|---|---|---|
| `Rainyforest23.github.io` | minimal-mistakes | 한국어 기술 블로그 포스트 24개 |
| `Woorim-Shin-cv` | al-folio | 영문 CV, 프로젝트 11개, `cv.yml` + `resume.json`, `papers.bib` |

목표:

1. 해외 기업 지원용: CV·포트폴리오 영역과 블로그 영역을 분리한다.
2. 블로그는 Obsidian 볼트를 원고로 삼고, 볼트의 연결 구조(wikilink, 백링크)를 사이트에서 보여준다.
3. 정적 콘텐츠 위에 작은 동적 백엔드를 얹은 풀스택 구성을 직접 설계·구현·운영한다.

범위 밖(이번 설계에서 다루지 않음):

- 비주얼 디자인 확정: 별도 디자인 세션에서 정한다. 이 문서는 교체 가능한 구조와 브리프만 정의한다 (§8).
- 댓글, 연락 폼, 자체 방문 분석, 관리자 대시보드 (§6.3).
- 완전 이중언어(i18n) 라우팅.

## 2. 확정된 결정

| # | 결정 | 채택 | 기각한 대안 |
|---|---|---|---|
| D1 | 백엔드 깊이 | 경량 동적: 정적 콘텐츠 + 소수 API | 본격 백엔드(인증·CRUD), 완전 정적 |
| D2 | 볼트 연동 | 빌드타임 export | 런타임 API(홈서버 의존), 분리 유지 |
| D3 | 호스팅 | AWS: S3 + CloudFront + Lambda + DynamoDB, CDK(TypeScript) | OpenNext/SST, ECS Fargate + RDS |
| D4 | DNS·도메인 | Cloudflare Registrar + Cloudflare DNS (프록시 끔) | Route 53 |
| D5 | 언어 | 영문 우선. 루트·CV·프로젝트는 영문, 블로그 글은 원문 언어 + 영문 요약 | 완전 i18n, 전면 영문 |
| D6 | 콘텐츠 원본 | 기존 24개는 `content/legacy/`에 고정, 신규 글은 볼트 | 볼트 전면 흡수, 대표글만 이관 |
| D7 | 볼트 UX 범위 | wikilink + 백링크 + 로컬 그래프(1~2홉) + 태그 | 미니멀, 전역 그래프·호버 프리뷰 |
| D8 | UI 구현 | shadcn/ui는 동작·접근성 primitive로만, 룩은 자체 토큰 | 수작업 전부, shadcn 기본 룩 |
| D9 | 도메인 | 브랜드/닉네임 계열(rainyforest). 정확한 이름은 구매 시 CDK 설정값 `siteDomain`으로 주입 | 이름+.dev, 이름+.com |
| D10 | 레포 | 새 단일 레포 `rainyforest-web` (public). 기존 두 레포는 이행 후 아카이브 | 기존 레포 재활용, pnpm 모노레포 |

설계 도중 뒤집은 결정 (기록용):

- 볼트를 git submodule로 두는 안 → **`VAULT_DIR` 환경변수 + CI clone**. submodule은 글을 쓸 때마다 포인터 커밋을 요구한다.
- Obsidian 동기화용 webhook Lambda → **삭제**. 볼트 push → 사이트 빌드는 GitHub `repository_dispatch`로 충분하다.
- Cloudflare 프록시로 DDoS 방어 → **프록시 끔**. CDN이 두 겹이 되면 캐시 무효화·SSL 설정을 두 곳에서 맞춰야 한다. CloudFront의 Shield Standard와 Lambda 예약 동시성으로 대체한다.

## 3. 시스템 구조

원칙: **볼트는 사이트의 런타임 의존성이 아니라 빌드 입력이다.** 볼트, 노트북, 홈서버가 모두 꺼져도 사이트는 동작한다.

```
[Obsidian 볼트 (iCloud)] ──push──▶ [GitHub: vault (private)] ──repository_dispatch──┐
                                                                                    ▼
[rainyforest-web (public)] ──push──▶ GitHub Actions (OIDC)
                                       1. vault clone (HEAD)
                                       2. 콘텐츠 파이프라인 + 검증 게이트
                                       3. next build (static export) + Pagefind
                                       4. s3 sync --delete, KVS 갱신, /* 무효화
                                                         ▼
Cloudflare DNS (DNS only) ──▶ CloudFront ──OAC──▶ S3 (비공개)
                                  │
                                  └── /api/* ──OAC──▶ Lambda Function URL ──▶ DynamoDB
```

### 3.1 레포 구조

```
rainyforest-web/
├─ app/                    Next.js App Router, output: 'export'
│   └─ tokens.css          룩 정의의 유일한 위치 (§8)
├─ components/
│   ├─ primitives/         shadcn 생성물
│   └─ site/               사이트 전용 컴포넌트
├─ lib/
│   ├─ content/            콘텐츠 파이프라인 (빌드타임 전용)
│   │   ├─ model.ts        Post / Project / LinkGraph 타입 — app/과의 유일한 계약
│   │   ├─ adapters/vault.ts
│   │   ├─ adapters/legacy.ts
│   │   ├─ adapters/projects.ts
│   │   ├─ wikilink.ts
│   │   ├─ validate.ts     검증 게이트
│   │   └─ index.ts        어댑터 합성 → Post[] + Project[] + graph.json + 리다이렉트 맵
│   └─ cv/                 JSON Resume 스키마 로딩·검증
├─ content/
│   ├─ legacy/             변환 완료된 블로그 포스트 24개 (고정)
│   ├─ projects/           프로젝트 케이스 스터디 MDX
│   └─ resume.json         CV 단일 원본 (JSON Resume 스키마)
├─ api/views/              Lambda 핸들러 (TypeScript, Node 22)
├─ infra/                  AWS CDK 스택 1개
└─ .github/workflows/
```

전 계층 TypeScript. 앱·파이프라인·Lambda·CDK가 타입(`Post`, API 응답)을 공유한다.

## 4. 콘텐츠 파이프라인

### 4.1 계약 (`lib/content/model.ts`)

```ts
export type Source = 'vault' | 'legacy'

export interface Post {
  slug: string          // URL 경로. 파일명과 무관하게 고정
  title: string
  summaryEn: string     // 영문 1~2줄. 발행 글 필수
  lang: 'ko' | 'en'
  date: string          // ISO 8601
  updated?: string
  tags: string[]
  source: Source
  status?: 'seed' | 'growing' | 'evergreen'   // vault 전용
  project?: string      // 연결된 Project slug
  body: string          // 변환 완료 MDX
  outgoing: string[]    // 이 글이 링크하는 slug
}

export interface Project {
  slug: string
  title: string
  summary: string
  outcome?: string      // 한 줄 결과, 목록에 노출
  period: { start: string; end?: string }   // end 없음 = Present
  role: string
  teamSize?: number
  stack: string[]
  category: 'research' | 'ai' | 'systems' | 'data'
  links?: { repo?: string; paper?: string; demo?: string; slides?: string }
  featured?: boolean
  series?: string
  body: string
}

export interface LinkGraph {
  nodes: { slug: string; title: string; tags: string[] }[]
  edges: { from: string; to: string }[]
}
```

백링크와 프로젝트별 관련 글은 저장하지 않고 `LinkGraph`와 `Post.project`에서 파생한다. 원본은 하나만 둔다.

### 4.2 볼트 어댑터

볼트 frontmatter에는 아래 필드만 추가한다 (`summary_en`은 `Post.summaryEn`으로 매핑). 기존 `type`/`status`/`lifecycle`/`tags`/`aliases`/`related`는 건드리지 않는다.

| 필드 | 의미 |
|---|---|
| `publish: true` | 없거나 false면 사이트에 절대 나오지 않는다. 기본값은 비공개 |
| `slug: <kebab-case>` | 발행 글 필수. Templater 템플릿이 발행 전환 시 제목에서 생성해 채운다 |
| `summary_en:` | 발행 글 필수 |
| `project: <slug>` | 선택. 해당 프로젝트 상세 하단 "Notes & logs"에 자동 수집 |

변환 규칙:

| 입력 | 처리 |
|---|---|
| `[[노트]]`, 대상 발행됨 | 내부 링크 |
| `[[노트]]`, 대상 미발행 | 링크를 풀고 텍스트만 남긴다. 사이트에는 표시하지 않고, 빌드 로그에 목록으로 출력한다 |
| `[[노트\|별칭]]`, `[[노트#헤딩]]` | 별칭·앵커 보존 |
| `![[assets/x.png]]` | `public/notes/<slug>/x.png`로 복사, sharp로 리사이즈 (static export에는 이미지 최적화 서버가 없음) |
| ` ```mermaid ` | 빌드타임 SVG 렌더링 (rehype-mermaid + Playwright) |
| `aliases: [...]` | 구 경로 → 정식 slug 301 리다이렉트 맵 생성 |

### 4.3 레거시·프로젝트 어댑터

- 레거시 24개: 1회성 스크립트로 Jekyll frontmatter(`categories`/`tags`/`toc`)를 `Post`로 바꿔 `content/legacy/`에 커밋한다. 영문 요약(`summaryEn`)은 이때 채운다. **스크립트는 커밋하지 않고 버린다.**
- 프로젝트: al-folio `_projects/` 11개 중 "Technical Talks & Sessions"는 CV의 Talks 섹션으로 옮기고, 나머지 10개를 변환한다. 본문 첫 줄의 `**기간 | 스택 | 역할**`을 `period`/`stack`/`role`로 파싱하고 본문은 그대로 둔다. `importance` 필드는 버린다.

### 4.4 검증 게이트

빌드 실패:

- 발행 글의 `slug` 누락, `summary_en` 누락
- slug 중복 (legacy ↔ vault 충돌 포함)
- 이미지 참조 깨짐
- `Post.project`가 존재하지 않는 Project를 가리킴
- Project 필수 필드 누락 (`title`/`summary`/`period.start`/`role`/`stack`/`category`)

경고(빌드 계속):

- 미발행 노트로의 wikilink 목록
- 편집거리 1 이내 유사 태그 (오타 의심)

### 4.5 산출물

정적 HTML, `graph.json`, Pagefind 검색 인덱스(CJK 지원), 리다이렉트 맵(KVS에 업로드), 빌드에 사용한 볼트 커밋 SHA(빌드 메타데이터).

## 5. 사이트 구조

| 경로 | 내용 | 원본 |
|---|---|---|
| `/` | 짧은 소개, featured 프로젝트, 최근 글 | `resume.json`, `Project[]`, `Post[]` |
| `/cv` | 경력·학력·논문·Talks 전체, PDF 다운로드 | `resume.json`, `papers.bib`, featured `Project[]` |
| `/projects` | 포트폴리오 목록, 카테고리 필터(클라이언트) | `Project[]` |
| `/projects/[slug]` | 케이스 스터디 + "Notes & logs" | `Project`, `Post.project` 역참조 |
| `/blog` | 글 목록 | `Post[]` |
| `/blog/[slug]` | 글 + 백링크 + 로컬 그래프 | `Post`, `LinkGraph` |
| `/blog/tags/[tag]` | 태그 인덱스 | `Post[]` |
| `/feed.xml`, `/sitemap.xml` | RSS, 사이트맵 | 빌드 산출 |

검색은 `⌘K` 커맨드 팔레트(shadcn Command + Pagefind)로 제공한다.

### 5.1 CV

- `cv.yml`과 `resume.json`의 중복을 [JSON Resume](https://jsonresume.org/schema) 스키마의 `content/resume.json` 하나로 합친다.
- JSON Resume의 `projects` 필드는 비워 둔다. `/cv`의 프로젝트 섹션은 featured `Project`에서 파생한다.

### 5.2 프로젝트 (포트폴리오)

레퍼런스(me.aiden-kwak.workers.dev/projects)의 리스트형 목록 + 케이스 스터디 상세 구조를 따르되, 목록에 역할·기간·결과를 추가한다.

- 목록 한 항목: 제목 + 한 줄 설명 / 역할 · 기간 · 주요 스택 / `outcome` 한 줄. 썸네일 없음.
- 정렬: `featured` 먼저(3~4개), 이어서 진행 중, 그다음 종료일 역순.
- 상세 권장 구성: Context → Problem → Decisions(결정마다 대안과 선택 이유) → Result → Stack. 권장일 뿐 검증하지 않는다.
- `series`: 필드만 둔다. 같은 series가 3개 이상이 되면 시리즈 페이지를 만든다.
- 케이스 스터디 형식으로 다시 쓰는 작업은 콘텐츠 작업이다. featured부터 순차적으로 하며, 공개를 막지 않는다.

## 6. 동적 백엔드

### 6.1 API

Lambda 1개, 테이블 1개.

```
GET  /api/views?slugs=a,b,c   → 200 { "a": 120, "b": 8, "c": 0 }
POST /api/views/{slug}        → 200 { "count": 121 }
```

### 6.2 DynamoDB (단일 테이블, 온디맨드)

| PK | 속성 | 용도 |
|---|---|---|
| `VIEW#<slug>` | `count: Number` | UpdateItem `ADD`로 원자적 증가 |
| `SEEN#<slug>#<YYYY-MM-DD>#<ipHash>` | `ttl` (48시간) | 조건부 Put 성공 시에만 증가. 새로고침 중복 방지 |

IP 원문은 저장하지 않는다. 일별 솔트로 해시한 값만 쓴다. 만료 레코드는 DynamoDB TTL이 삭제한다.

### 6.3 만들지 않는 것

| 기능 | 대안 | 재검토 조건 |
|---|---|---|
| 방문 분석 | Cloudflare Web Analytics (JS 비콘, 쿠키 없음) | — |
| 댓글 | 없음 | 필요해지면 Giscus. DB 추가 없음 |
| 연락 폼 | `mailto` | 필요가 증명되면 SES 폼 (스팸 대응 포함) |
| 볼트 webhook | GitHub `repository_dispatch` | — |

### 6.4 실패 처리

- 조회수 API 실패·타임아웃: 클라이언트가 숫자를 숨긴다. 페이지 렌더링을 막지 않는다.
- 콘텐츠 오류: 검증 게이트에서 빌드 실패 → 배포되지 않고 기존 사이트가 유지된다.
- 배포 실패: 이전 커밋으로 워크플로를 다시 실행해 롤백한다.

## 7. 인프라 · 배포 · DNS

### 7.1 AWS (CDK 스택 1개, us-east-1)

리전을 us-east-1 하나로 둔다. CloudFront 인증서가 어차피 us-east-1이어야 하므로 리전 간 스택 참조를 없앤다.

| 리소스 | 설정 |
|---|---|
| S3 | 퍼블릭 액세스 전면 차단, CloudFront OAC로만 읽기 |
| CloudFront | ACM 인증서(us-east-1, apex + `www` SAN), 기본 동작 → S3, `/api/*` → Lambda Function URL(OAC) |
| CloudFront Function (viewer-request) | `www` → apex 301, KVS 리다이렉트 맵 조회 후 301, `/blog/foo` → `/blog/foo/index.html` 보정 |
| CloudFront KeyValueStore | 리다이렉트 맵. 콘텐츠 배포가 갱신하므로 인프라 재배포 불필요 |
| 캐시 | 해시 붙은 에셋 1년 immutable, HTML은 배포 시 `/*` 무효화 |
| Lambda | Node 22, **VPC 밖**, 예약 동시성 5, Function URL + OAC (POST 본문 없음 → 본문 해시 헤더는 상수) |
| DynamoDB | 온디맨드, TTL 속성 `ttl` |
| CloudWatch Logs | 보존 14일 |
| AWS Budgets | 월 $5 초과(실제·예측) 이메일 알림. 계정 전체 비용 기준. 알림 주소는 배포 시 환경변수로 주입(레포에 커밋하지 않음) |

### 7.2 배포 파이프라인

| | 콘텐츠 배포 | 인프라 배포 |
|---|---|---|
| 빈도 | 글 쓸 때마다 | 드묾 |
| 트리거 | 사이트 main push, 볼트 push → `repository_dispatch` | 수동 |
| 과정 | vault clone → 검증 → build → s3 sync → KVS 갱신 → 무효화 → 배포 후 스모크 | PR에 `cdk diff` 자동 코멘트, 적용은 로컬 `cdk deploy` |
| 권한 | GitHub OIDC 역할 (S3·KVS·무효화만) | 본인 자격증명 |
| 롤백 | 이전 커밋으로 재실행 | `git revert` 후 `cdk deploy` |

GitHub에는 장기 액세스 키를 두지 않는다. 비밀값은 두 개뿐이다: 볼트 읽기 전용 deploy key, 볼트 → 사이트 dispatch용 fine-grained 토큰.

로컬 개발은 `VAULT_DIR`이 iCloud 볼트를 직접 가리킨다. 저장하자마자 미리보기가 가능하다.

### 7.3 Cloudflare (수동 설정, README에 문서화)

레코드가 몇 개뿐이고 거의 바뀌지 않으므로 두 번째 IaC 도구(Terraform)를 들이지 않는다.

| 레코드 | 값 |
|---|---|
| apex | CNAME → CloudFront 도메인 (DNS only, CNAME flattening) |
| `www` | CNAME → CloudFront 도메인 (DNS only). apex로의 301은 CloudFront Function이 처리한다. Cloudflare Redirect Rule은 프록시가 켜진 레코드에만 동작하므로 쓰지 않는다 |
| `_<token>.<apex>` | ACM 검증 CNAME. **지우면 인증서 자동 갱신이 실패한다** |

### 7.4 예상 비용

월 2만 페이지뷰 기준 AWS는 약 $0.1 이하, 도메인 포함 월 약 $1~2 (연 $15~25). 하루 10만 뷰가 몰려도 상시 무료 한도 안이며 DynamoDB 쓰기 약 $0.25만 늘어난다. 단가는 2026년 5월 기준이므로 배포 전 AWS Pricing Calculator로 확인한다.

비용 사고 방어책: Lambda VPC 밖(NAT Gateway 회피), 예약 동시성 상한, 로그 보존 기한, Budgets 알림. 이 네 가지는 CDK assertion 테스트로 고정한다 (§9).

## 8. 디자인 계약

### 8.1 구조

- 룩은 `app/tokens.css`(Tailwind v4 `@theme`, CSS 변수) 한 파일에서만 정의한다: 색, 타입 스케일, 간격, radius, 모션, 라이트/다크.
- `components/primitives/`와 `components/site/`는 토큰만 참조한다. `tokens.css` 밖의 hex 색상·임의 px 값은 CI 검사로 막는다.
- 이행 1~5단계는 중립 토큰으로 진행한다. 디자인 교체는 `tokens.css` diff와 일부 레이아웃 조정으로 끝나야 한다.

### 8.2 디자인 세션 브리프

세션 시작 전에 Anthropic 공식 `frontend-design` 스킬(`anthropics/skills`)을 설치한다.

| 항목 | 내용 |
|---|---|
| 주제 | 시스템·온디바이스 AI 문제를 다루는 엔지니어 겸 연구자 |
| 독자 | 해외 채용 담당자, 엔지니어링 매니저, 연구자 |
| 핵심 역할 | 30초 안에 "무슨 문제를 푸는 사람인가"를 전달하고, 케이스 스터디로 판단 과정을 보여준다 |
| 피할 것 | 스킬이 열거한 AI 기본값 5종(크림 배경+세리프+테라코타, 검정+형광 액센트, 헤어라인·radius 0 신문 조판, SaaS 카드 키트, ALL-CAPS eyebrow·가운뎃점 메타·모노 라벨·`→` 링크), 금지 서체(Inter/Roboto/Arial/Space Grotesk) |
| 필수 조건 | 한글 글리프 페어링 (블로그 글 대부분이 한국어) |
| 품질 하한 | 모바일 반응형, 키보드 포커스 표시, `prefers-reduced-motion`, 라이트/다크, WCAG AA 대비 |

설계 중 검토한 "페이퍼·에디토리얼" 방향은 위 AI 기본값 1·3·5번에 해당하므로 출발점으로 쓰지 않는다.

## 9. 테스트 전략

| 층 | 도구 | 대상 |
|---|---|---|
| 콘텐츠 파이프라인 | Vitest + 픽스처 md | 어댑터 3종, §4.2 변환 규칙 표 전체, §4.4 검증 게이트 |
| CV 데이터 | JSON Resume 스키마 검증 (ajv) | `content/resume.json` |
| Lambda | Vitest + `aws-sdk-client-mock` | 중복 방지 조건부 Put, 원자적 증가, 잘못된 slug 입력 |
| 인프라 | CDK assertions | S3 비공개, Lambda VPC 밖, 예약 동시성, 로그 14일, OAC |
| 빌드 산출물 | lychee | 내부 링크 전수 |
| 토큰 규칙 | CI 검사 스크립트 | `tokens.css` 밖 hex·px 값 |
| E2E | Playwright 스모크(약 5개) + axe | 주요 페이지 렌더링, `⌘K` 검색, 조회수 API 장애 시 숫자 숨김, 접근성 |
| 배포 후 | curl 스모크 | 실제 도메인 HTTPS 응답, `/api/views` 200 |

하지 않는 것: 시각 회귀 스냅샷. 디자인 교체가 예정돼 있어 깨지는 것이 정상인 기간이 길다.

## 10. 이행 순서

각 단계는 그 자체로 배포 가능해야 한다.

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 0 | 볼트 private GitHub remote 생성·push, 도메인 구매 | 사전 준비 완료 |
| 1 | Walking skeleton: 빈 Next 앱 + CDK 스택 + 콘텐츠 배포 워크플로 + Cloudflare DNS | 실제 도메인에서 HTTPS로 페이지 응답, 배포 후 스모크 통과 |
| 2 | CV: `resume.json` 통합, 프로젝트 10개 변환, `/` `/cv` `/projects` | 지원서에 링크할 수 있는 최소 사이트 |
| 3 | 레거시 24개 변환, `/blog`, 태그, RSS | 기존 블로그 대체 가능 |
| 4 | 볼트 파이프라인, 검증 게이트, 백링크·로컬 그래프, `⌘K` 검색 | 볼트에서 발행 가능 |
| 5 | 조회수 API (Lambda + DynamoDB) | 풀스택 구성 완성 |
| 6 | 디자인 적용 (별도 디자인 세션 결과) | 공개 가능한 룩 |
| 7 | 전환: github.io에 새 도메인 리다이렉트 스텁, 기존 두 레포 아카이브 | 이행 완료 |

외부에 알리는 전환(7단계)은 디자인 적용(6단계) 이후에 한다. 디자인 세션은 2단계 이후 언제든 병행할 수 있다.

**2026-09-20 변경:** 도메인 구매를 최후순위로 미룬다. 1단계의 코드(Task 1~5)는 완료했고, 실제 배포(1단계 Task 6)는 도메인을 구매한 뒤에 한다. 그때까지 2~5단계를 로컬에서 진행한다. 대가로, 인프라·DNS·인증서를 실제로 뚫어 보는 검증이 그만큼 늦어진다. 배포가 처음 이뤄지는 시점에 그 위험이 한꺼번에 드러날 수 있다.

## 11. 사용자 선행 작업

코드 작업 전에 사용자가 직접 해야 하는 일:

1. 볼트에 private GitHub remote를 만들고 push한다. iCloud 안의 `.git`은 동기화 충돌 위험이 있으므로 GitHub를 정본으로 둔다.
2. 도메인 이름을 정해 Cloudflare Registrar에서 구매한다.
3. 볼트 Templater에 발행 전환 템플릿(`publish`, `slug`, `summary_en` 채우기)을 추가한다. 이행 4단계(§10)에서 템플릿 초안을 제공한다.
