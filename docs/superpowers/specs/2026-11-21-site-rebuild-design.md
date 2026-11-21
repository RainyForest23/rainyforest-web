# 개인 사이트 재설계: 경험 지도 + FDE 공부 기록

- 작성일: 2026-11-21
- 상태: 승인됨 (2026-11-21)
- 이전 설계: `2026-09-19-personal-site-design.md` (Next.js 기반). 이 문서가 대체한다. 이전 설계에서 그대로 가져가는 결정은 §4.4에 모았다.
- 판단 기준: **장기 유지보수 용이성.** 선택지가 갈리면 운영할 코드와 설정이 적은 쪽을 고른다.

## 1. 의도

이 사이트는 두 가지 일을 한다.

1. **Palantir FDE 재지원 준비 기록.** 공부한 것(Study)과 거기서 나온 문제 해결 원칙(Principles)이 날짜와 함께 쌓이고, 원칙이 어디서 와서 어느 경험에 쓰였는지가 Foundry의 데이터 리니지처럼 남는다.
2. **경험을 한눈에 보여 주는 포트폴리오.** 첫 화면의 연도별 타임라인에 모든 경험이 보이고, 핵심 경험(시대인재, Hiconsy)은 그림으로 원리를 설명하는 딥다이브 페이지를 가진다. 참고: cs.yeolyi.com (Astro + React islands, 그림·코드 실행 중심의 설명 페이지).

여기에 하나가 더 붙는다. **사이트를 만드는 과정 자체가 풀스택 공부다.** 핵심 부분은 사이트 주인이 직접 구현하고, 그 과정이 Study 기록으로 남는다 (§11).

읽는 사람: 해외 기업 채용 담당자와 면접관(영어), 그리고 나중에 다시 지원 서류를 쓰는 사이트 주인 본인.

## 2. 목표, 하지 않을 것, 실패 기준

목표

- 첫 화면 하나에서 2023년부터 지금까지의 경험이 갈래별 막대로 보인다.
- 경험 페이지가 "누구의 어떤 결정을 도왔나"부터 시작하는 분해 과정을 보여 준다.
- 원칙 페이지마다 출처(위쪽)와 적용 사례(아래쪽), 수정 이력이 자동으로 이어진다.
- 브라우저에서 바로 실행되는 Python 코드 셀로 공부 노트를 쓸 수 있다.
- Keynote 발표 자료를 애니메이션 그대로 전시한다.
- 영어가 기본이고 한국어로 바꿔 볼 수 있다.

하지 않을 것

- 로그인, 댓글, 방문자 분석, 관리자 화면.
- 모든 경험에 anatomy 그림을 그리는 것. anatomy는 핵심 경험 둘에만 쓴다.
- 모든 글의 완전한 이중언어 번역.
- 필요 없는 서버 코드. 백엔드는 실제로 필요한 곳(Keynote 파일 제공)에만 둔다.

실패 기준 (동작은 해도 실패로 본다)

- 회사 코드, 회사 데이터, 실제 강의 내용, 면접 내용이 공개된다.
- 확인되지 않은 수치가 실린다. (예: LLM 벤치마크 "6종"은 틀렸고 실제는 3종)
- 지금 다시 분해한 내용이 그때 한 일처럼 읽힌다.
- 흔한 AI 생성 사이트처럼 보인다. (둥근 카드 남발, 알약 모양 태그, 보라색 그라디언트 등)
- 사이트 주인이 사이트 구조를 설명하지 못한다. 공부가 목적의 하나이므로, 핵심 코드를 이해 못 한 채 남으면 실패다.

## 3. 제약

공개 범위

| 대상 | 공개 | 비공개 |
|---|---|---|
| Hiconsy | 시스템 구조, 확인된 수치 | 코드, 데이터, 실제 강의 자막. 예시 자막은 가짜로 만든 문장만 |
| 시대인재 | 시스템 구조, 수치 | 코드, 학생 데이터, 내부 화면 |
| Palantir | 공개 문서와 강의에서 배운 것 | 면접 메일, 면접 질문과 답, `CONFIDENTIAL` 파일. 자동 검사가 불가능하므로 작성 규칙으로 지킨다 (§8.4) |
| 개인 정보 | 이름, 이메일, GitHub, LinkedIn | 학점(GPA). 공개 레포이므로 `resume.json`에서도 `score` 필드를 지운다 |
| Keynote | 모든 덱 공개 가능 (2026-11-21 본인 결정). 처음에는 한 덱(Tesla Jr.)으로 파이프라인을 세우고 나머지는 보류 | 덱 안에 넣은 데모 영상은 전부 제외. 덱을 추가할 때마다 회사 코드·데이터·내부 화면이 없는지 슬라이드를 훑어본다 |

확인된 수치만 쓴다

- Hiconsy 20.7배: PAD/EOS 토큰 분리와 SoT 강제 수정의 결과. 107.2분 강의 1건 기준. WER 58.98→30.75, CER 43.76→15.85, 삽입 오류 3,622→175. 검색 교정(RAG)의 결과가 아니다.
- LLM 벤치마크: 3종. 기존 `content/projects`의 "6 production LLMs"는 고친다.

문장

- 영어가 기본. 한국어 문장은 쉬운 말로 쓴다. 낯선 한자어나 번역투 단어("버팀" 등)는 쓰지 않는다.

비용

- 무료 한도 안에서 운영한다. Cloudflare Workers 무료(요청 하루 10만), R2 무료(저장 10GB, 내려받기 요금 없음).

## 4. 접근 방식

### 4.1 프레임워크: Astro + React islands (채택)

| | Astro + React islands (채택) | Next.js 16 유지 |
|---|---|---|
| 콘텐츠 | Content collections + Zod 스키마로 빌드 때 형식 검사 | Ajv 검사 코드를 직접 유지 |
| 움직이는 그림, 코드 셀 | 필요한 컴포넌트만 JS를 실음 | 페이지 전체가 React, 기본 JS가 무거움 |
| 영어/한국어 | 내장 i18n 라우팅 | 직접 구현 |
| 위험 | 새로 배울 것 | Next 16 API 변화, 정적 사이트에 과한 기능 |

참고 사이트(cs.yeolyi.com)도 같은 구성이다 (2026-11-21 HTML로 확인: `astro-island` 13개, React 렌더러, `PythonRunner` island).

### 4.2 호스팅: Cloudflare Workers 정적 에셋 + R2 (채택)

| | Cloudflare + R2 (채택) | GitHub Pages |
|---|---|---|
| 페이지 | 이미 workers.dev에 설정됨 | 무료, 단순 |
| Keynote | 같은 계정 R2, 10GB 무료 | 사이트 1GB 권장 한도. 덱 30개면 넘칠 수 있어 별도 저장소가 필요 |
| 도메인 | Cloudflare DNS 한 곳 | 별도 연결 |

Vercel(참고 사이트의 호스팅)도 검토했으나 덱 파일을 둘 곳이 따로 필요해 GitHub Pages와 같은 문제를 가진다.

### 4.3 레포: rainyforest-web에서 새로 시작 (채택)

`rebuild/astro` 브랜치에서 Next.js 코드를 지우고 Astro로 다시 세운다. 레포 이름, Cloudflare 설정, CI, 커밋 기록을 유지한다. 새 레포는 이것들을 다시 설정하는 비용만 생긴다.

### 4.4 이전 설계에서 가져가는 것

| 가져감 | 바뀌는 점 |
|---|---|
| `content/resume.json` (JSON Resume + `talks`) | 그대로. `/cv`의 원본 |
| `content/projects/*.mdx` 10편 | 경험(Experience) 콘텐츠의 재료. 형식은 §6으로 다시 쓴다. "6종" 수정 |
| `content/legacy/*.mdx` 18편 + `redirects.json` | 그대로 `/blog/` 아래에 보존. 옛 github.io 주소 24개 리다이렉트 유지 |
| 토큰 규칙 (`tokens.css` 밖에 색·px 금지) + 검사 스크립트 | Astro 파일(`.astro`)까지 검사 대상 확장 |
| 내부 링크 검사 | 빌드 결과(`dist/`) 기준으로 경로 해석만 바꿈 |
| RSS 생성(XML 이스케이프 포함) | Astro 엔드포인트로 옮김 |
| `remark-gfm`, `remark-math` + `rehype-katex` | Astro MDX 설정으로 옮김 |
| Cloudflare `wrangler.jsonc`, `_headers` | 빌드 폴더 `out` → `dist`, Worker 스크립트 추가 (§9) |
| `deploy.yml` 비활성 상태 | 유지. 도메인 구매 후 켠다 |
| "영어 우선, 글은 원문 언어 + 영어 요약" | 한국어 토글 추가로 확장 (§10) |

버리는 것: Next.js 앱 코드, `infra/`·`cdk.json`·`cdk.out`(AWS 잔재), shadcn/ui와 `components/primitives/`, Ajv 스키마(Zod로 대체), Obsidian 볼트 빌드 파이프라인 계획(§8.5).

## 5. 사이트 구조

| 경로 | 내용 |
|---|---|
| `/` | 짧은 소개 + 연도별 경험 타임라인 |
| `/work/[slug]` | 경험 페이지. 핵심 둘은 딥다이브 |
| `/principles` , `/principles/[slug]` | 원칙 목록, 원칙 페이지(리니지 + 이력) |
| `/study` , `/study/[slug]` | 공부 기록 목록(날짜순), 기록 페이지. 로드맵 체크리스트는 `/study` 상단 |
| `/keynotes` | 덱 전시 벽, 클릭 시 재생 |
| `/cv` | `resume.json`에서 생성. PDF 내려받기 |
| `/blog` , `/blog/[slug]` | 옛 글 18편 보관 |
| `/ko/...` | 위 모든 경로의 한국어판 (§10) |
| `/feed.xml`, `/sitemap.xml` | Study + blog RSS, 사이트맵 |

상단 메뉴: Work · Principles · Study · Keynotes · CV, 오른쪽에 EN/KO.

## 6. 온톨로지 (콘텐츠 모델)

사이트의 모든 콘텐츠는 아래 객체와 관계로 이루어진다. 이 모델을 설계하고 구현하는 일이 첫 FDE식 연습이다.

```
Source ◀─cites── StudyLog ──develops──▶ Principle ◀──applies── Step ──part-of──▶ Experience
                                            ▲                                       │
                                  History(git)                         Deck ──presented-at──┘
                                                                       Experience ──on──▶ Timeline
```

### 6.1 객체

| 객체 | 파일 | 주요 필드 |
|---|---|---|
| Experience | `content/experiences/[slug].mdx` | `title`, `org`, `lane`(work/research/club/study/award), `period{start,end?,approximate?}` 또는 `date`, `tier`(deep/standard/brief), `hero`(anatomy/pipeline/none), `summary`, `role`, `stack[]`, `outcome?`, `resumeRef?` |
| Step | Experience MDX 안의 `<Step>` 컴포넌트 | `n`(1–8), `applies[]`(principle slug) |
| Principle | `content/principles/[slug].mdx` | `title`, `summary`, `status`(draft/stable) |
| StudyLog | `content/study/[YYYY-MM-DD]-[slug].mdx` | `title`, `date`, `kind`(log/python/notes/build), `develops[]`(principle slug), `cites[]`(source id), `lang` |
| Source | `content/sources.yaml` | `id`, `title`, `url`, `kind`(doc/course/book/talk) |
| Deck | `content/decks/[slug].yaml` | `title`, `date`, `presentedAt?`(experience slug), `summary`, `slides`, `r2Prefix` |
| Post | `content/legacy/[slug].mdx` | 기존 형식 그대로 |

- 날짜는 `YYYY` 또는 `YYYY-MM`. 확정되지 않은 기간은 `approximate: true`. *(Claude 결정)*
- `tier: brief`는 페이지 없이 타임라인 막대와 한 줄 설명만 가진다 (동아리, 수상 등).
- 관계는 전부 frontmatter나 컴포넌트 속성에 slug로 적는다. 반대 방향(원칙 → 적용한 경험, 원칙 → 출처가 된 공부 기록)은 빌드 때 계산한다. 반대 방향을 손으로 적지 않는다.

### 6.2 검사

빌드가 실패하는 경우:

- 없는 slug를 가리키는 관계 (예: `develops: [no-such-principle]`).
- `period.end`가 `start`보다 앞섬, 날짜 형식 오류.
- `tier: standard` 이상에서 8단계 중 빠지거나 겹친 단계 (`n`은 페이지 안에서 1–8 각각 한 번).
- `tier: deep`인데 `hero`가 `anatomy`가 아니면 **경고만** 낸다. 그림이 나오는 6단계 전까지 `hero: pipeline`으로 빌드가 통과한다. *(Claude 결정)*
- `resumeRef`가 있는 경험의 기간이 `resume.json`의 해당 항목과 다름. 비교는 둘 중 거친 쪽 정밀도로 한다 (`2025` vs `2025-06`은 일치). *(Claude 결정)*
- `tokens.css` 밖의 색·px 값, 깨진 내부 링크.

### 6.3 타임라인

- 데이터: `lane`과 기간이 있는 모든 Experience. 갈래는 Work / Research / Club / Study / Awards.
- 데스크톱: 가로축 연도, 갈래별 막대. 핵심 경험(`tier: deep`)은 진한 색. 진행 중인 경험은 끝이 열린 무늬. 수상은 점.
- 모바일: 세로 방향. 연도가 위에서 아래로 흐르고 막대가 세로로 선다. 가로 스크롤 없음.
- 막대 클릭: 페이지가 있으면 이동, brief면 그 자리에 한 줄 설명.
- `approximate: true`인 경험은 막대 끝을 흐리게 표시한다 (§13).

## 7. 경험 페이지

### 7.1 등급

| 등급 | 대상 (초안) | 첫 그림 | 본문 |
|---|---|---|---|
| deep | 시대인재(SDIJ Forest), Hiconsy 강의 ASR | anatomy 그림 | 8단계 전부 + 그림 키트 |
| standard | SoundSight, Tesla Jr., 연구(캡스톤 VM 전력, 에너지 비용 모델, DAIA) | 그림 키트 중 하나 | 8단계 (짧아도 됨) |
| brief | 동아리(GDGoC, AWS Cloud Club, UMC, 이화태권), 수상 | 없음 | 타임라인 한 줄 |

기존 프로젝트 10편 중 시대인재 시기의 것(학습 분석 자동화, 포럼 크롤러, 감성 분석, CSAT 질문 분류, LLM 벤치마크)은 시대인재 경험의 하위 문제로 합친다. `korean-lecture-asr`, `convpeft`는 Hiconsy로, `vm-power-attribution`, `ai-energy-cost-model`은 연구로 간다. 합친 하위 프로젝트는 별도 Experience나 타임라인 막대가 되지 않는다. 4단계 `DecompTree`의 노드가 되고, 각자의 결정과 결과는 해당 단계(주로 4, 6, 7) 안의 소제목으로 쓴다. 한 페이지의 8단계는 한 번씩만 나온다. *(Claude 결정)*

`fcoinman`(개인 프로젝트)은 타임라인에 올리지 않는다 (증빙 가능한 경험만 싣는 원칙).

### 7.2 8단계 틀

`03_Decomp_심층리서치.md`의 "결정 중심 분해"와 공유 문서 템플릿을 사이트용으로 줄였다. 제목은 영어, 한국어판 설명은 쉬운 말.

| # | 제목 | 묻는 것 | 그림 |
|---|---|---|---|
| 1 | Decision | 누구의 어떤 결정을 돕는가 | — |
| 2 | Before | 원래는 어떻게 했나 (숫자로) | — |
| 3 | Ontology | 객체, 관계, 행동 | 온톨로지 그림 |
| 4 | Smallest version | 가장 작은 작동 버전과 하위 문제 | 분해 트리 |
| 5 | Trade-offs | 선택지와 고른 이유 | — |
| 6 | What broke | 실패와 수정 | 단계 진행 그림 / 코드 스테퍼 |
| 7 | Measured | 결과와 피드백 고리 | 전·후 비교 |
| 8 | Next | 다음 버전 | — |

각 단계는 `<Step n={1} applies={['start-with-the-decision']}>`로 감싸고, 적용한 원칙으로 링크된다.

### 7.3 그때 한 일 / 지금 다시 분해하면

지원 서류의 근거가 되므로 두 가지를 섞지 않는다.

- 본문은 **그때 한 일(Then)** 이다. 실제로 한 결정과 결과만 쓴다.
- 지금의 관점으로 다시 분해한 내용은 `<Now date="2026-12-01">` 블록에만 쓴다. 다른 배경과 "Re-decomposed on 2026-12-01" 표시가 붙는다.
- `<Now>` 안에서는 수치를 새로 만들지 않는다.

### 7.4 그림 키트

모든 경험이 함께 쓰는 React island:

| 컴포넌트 | 용도 |
|---|---|
| `OntologyMap` | 객체·관계 그림. 객체를 누르면 속성과 행동 표시 |
| `DecompTree` | 결정 → 하위 문제 트리. 가지를 접고 펼침 |
| `BeforeAfter` | 버전 전환 시 수치 막대와 예시가 같이 바뀜 |
| `PipelineStepper` | 단계를 하나씩 진행하며 해당 부분 강조 |
| `CodeStepper` | 코드 한 줄씩 진행하며 변수 상태 표시 |

데이터는 MDX 옆의 YAML/JSON 파일로 넘긴다. 그림 코드와 데이터를 나눠 두어 경험마다 그림 코드를 새로 쓰지 않는다.

### 7.5 anatomy 그림 (deep 2개)

anatomy 스킬로 만든 아이소메트릭 SVG + TypeScript. 마우스를 올리면 부품 설명과 실측치를 읽는다.

- Hiconsy: 강의 테이프 → VAD 커터 → Whisper+LoRA 판독기 → 용어 서랍 → 자막 릴. 수치는 §3의 확인된 값만.
- 시대인재: 학생 질문이 투입구로 들어가 QM0–QM7 칸으로 분류되고, TA 자리로 배달되며, 위에 리더보드가 도는 분류 기계.
- 그림 하나에 몇 시간이 걸린다. 다른 단계가 그림을 기다리지 않도록, 그림이 없는 동안은 `PipelineStepper`로 대신한다.

## 8. Principles와 Study

### 8.1 원칙 페이지

```
Start with the decision, not the screen          v3 · 2026-12-04 updated

Lineage
  Source ─┐
  Study ──┼──▶ [ this principle ] ──▶ Hiconsy · 1 Decision
  Study ──┘                        ──▶ SDIJ · 1 Decision

History
  2026-12-04  Hiconsy 사례를 보고 "결정 주체" 문단을 고침
  2026-11-27  보안 요소 추가  ← Study: Foundry 권한 문서 읽기
  2026-11-20  처음 작성
```

- Upstream: 이 원칙을 `develops`에 적은 StudyLog와, 그 기록이 `cites`한 Source.
- Downstream: 이 원칙을 `applies`에 적은 Step(경험 + 단계 번호).
- 버전 번호: 원칙 파일을 바꾼 커밋 수 (merge 커밋 제외).

### 8.2 History는 git에서

- 빌드 때 `git log --follow -- content/principles/[slug].mdx`로 커밋 날짜와 제목을 뽑는다.
- 커밋 메시지에 `Because: study/[slug]` 줄(trailer)이 있으면 그 이력 줄이 해당 Study 기록으로 링크된다. 수정이 어디서 왔는지가 남는다.
- CI는 `actions/checkout`에 `fetch-depth: 0`을 준다. 얕은 복제(`git rev-parse --is-shallow-repository`가 true)에서 빌드하면 실패시킨다. 이력이 한 줄로 줄어든 채 배포되는 것을 막는다. *(Claude 결정)*
- PR은 squash가 아닌 merge commit으로 합친다 (지금 레포의 방식). squash는 원칙 수정 커밋을 하나로 뭉쳐 버전 수와 `Because:` 줄을 잃는다. *(Claude 결정)*
- 원칙 커밋 메시지는 독자가 읽는 문장이 되므로, 원칙 파일만 바꾸는 커밋에서는 바뀐 내용을 사람 말로 쓴다. 이 규칙은 `CONTRIBUTING.md`에 적는다.

### 8.3 Study 기록 종류

| kind | 내용 |
|---|---|
| `log` | 날짜별: 한 것, 막힌 곳, 다음 할 것 |
| `python` | Python 노트. `<PyCell>` 코드 셀은 브라우저에서 실행된다(Pyodide) |
| `notes` | Foundry·AIP 문서, 강의 정리 |
| `build` | 이 사이트를 만들며 배운 것 (§11) |

`/study` 상단의 로드맵 체크리스트(Foundry Aware 과정, Speedrun, 자격증 등)는 `content/study/roadmap.yaml`에서 그린다.

Pyodide: `PyCell`이 화면에 들어올 때만 jsDelivr에서 불러온다. 버전은 고정한다. 셀이 없는 페이지는 Pyodide를 받지 않는다.

### 8.4 면접 내용 금지

면접 메일, 질문, 답, 면접에서 받은 피드백은 어떤 형태로도 Study에 쓰지 않는다. 문장의 출처를 자동으로 판별할 방법이 없으므로 `CONTRIBUTING.md`의 작성 규칙과 PR 체크리스트 항목으로 지킨다.

### 8.5 Obsidian 볼트

이전 설계의 "볼트 → 빌드 파이프라인"은 버린다. **개인 볼트와는 연결하지 않는다** (2026-11-21 본인 결정). 개인 볼트에서 공개할 것만 골라 `content/study/` 등으로 옮겨 커밋하는 수작업 방식이다. 옮길 때 볼트 전용 문법(`[[wikilink]]`, 개인 태그)은 사이트 형식(frontmatter 관계)으로 바꾼다. 레포의 `content/` 폴더는 Obsidian에서 바로 열어 쓸 수 있게 유지한다(frontmatter와 파일 구조가 Obsidian과 충돌하지 않게).

## 9. Keynotes

### 9.1 화면

- 덱 표지를 벽에 걸린 액자처럼 배치. 마우스를 올리면 처음 몇 장이 8초 무음 영상으로 움직인다 (2026-11-21 시험: 표지 12KB, 영상 49KB).
- 클릭하면 화면이 어두워지고 Keynote HTML 내보내기 결과가 `iframe`으로 재생된다. 클릭/→로 넘김, Esc로 닫음.
- 덱마다 영어 요약 몇 줄. HTML 내보내기는 글자를 이미지로 그려서 검색·복사가 안 되기 때문이다.
- `presentedAt`가 있으면 경험 페이지와 타임라인에서도 링크된다.

### 9.2 변환 파이프라인 (macOS 로컬 스크립트)

`scripts/keynote/export.ts` (osascript로 Keynote 제어):

1. `content/decks/[slug].yaml`에 적힌 원본 덱을 연다.
2. HTML과 720p 동영상으로 내보낸다.
3. 덱 안에 넣은 영상 파일을 제거한다. 제거 후에도 나머지 슬라이드가 재생되는지 확인한다. 안 되면 그 덱은 원본에서 영상 슬라이드를 포스터 이미지로 바꾼 사본을 만들어 다시 내보낸다(수작업).
4. 웹에서 쓰지 않는 중복 파일을 지운다. (시험 덱에서 `pdf`/`pdfp`, `json`/`jsonp`가 두 벌씩 있었다. 어느 쪽이 쓰이는지는 구현 때 확인)
5. 동영상에서 8초 미리보기와 표지를 만든다(ffmpeg).
6. 결과를 R2의 `decks/[slug]/[content-hash]/`에 올리고 YAML에 `r2Prefix`를 기록한다.

시험 결과(Tesla Jr., 18장): 전체 279MB 중 덱 안 영상 217MB, 나머지 63MB. 영상 제거와 중복 정리 후 덱당 수십 MB를 예상한다.

원본 `.key` 파일과 변환 결과는 git에 넣지 않는다.

### 9.3 Worker (이 사이트의 서버 코드)

`wrangler.jsonc`에 Worker 스크립트를 추가한다. 정적 에셋은 지금처럼 무료로 바로 나가고, `/decks/*` 요청만 Worker가 R2에서 읽어 준다.

- R2 바인딩으로 객체를 읽는다. `Range` 요청을 지원한다(동영상 탐색).
- 경로에 content hash가 있으므로 `Cache-Control: immutable`.
- 공개 규칙: 공개 YAML에 적힌 `decks/[slug]/[content-hash]/` 접두사 아래 파일만 내보낸다. 빌드 때 이 접두사 목록을 Worker가 읽을 수 있는 JSON으로 만든다. 목록에 없는 접두사는 404. R2에 올렸지만 공개하지 않은 덱이 새지 않게 한다. *(Claude 결정)*
- 표지와 8초 미리보기는 작아서 R2가 아닌 정적 에셋(`public/decks/[slug]/`)에 둔다. *(Claude 결정)*
- r2.dev 공개 주소는 쓰지 않는다 (요청 제한이 있고 운영용이 아님).

## 10. 영어/한국어

- 영어판이 루트(`/`), 한국어판이 `/ko/`. Astro 내장 i18n 라우팅.
- 화면 문구(메뉴, 단계 제목 설명, 버튼)는 `src/i18n/{en,ko}.ts`의 사전으로 번역한다.
- 콘텐츠는 원문 언어로 한 번만 쓰고 `lang`에 원문 언어를 적는다. 번역본은 `[slug].[언어].mdx`로 옆에 둔다 (영어 원문의 한국어판은 `.ko.mdx`, 한국어 원문의 영어판은 `.en.mdx`). 원문은 그 언어 경로에, 번역이 없는 언어 경로에는 원문 + 안내. *(Claude 결정)*
- 옛 글(`content/legacy`)은 지금 구조를 그대로 둔다. `-ko`로 끝나는 별도 slug 쌍도 그대로 두어 URL과 리다이렉트가 바뀌지 않게 한다. 없으면 `/ko/`에서도 원문을 보여 주고 "This page is in English" / "이 글은 한국어로만 있습니다" 같은 안내를 붙인다.
- 우선 번역 대상: 첫 화면, deep 경험 2개, 원칙 페이지. 나머지는 원문만.
- 언어 전환 버튼은 같은 페이지의 다른 언어판으로 간다. 없으면 그 언어의 목록 페이지로 간다.

## 11. 같이 공부하며 만들기

방식: 나눠서. 사이트 주인이 핵심 부분을 직접 쓰고 Claude가 리뷰한다. 반복 작업과 설정은 Claude가 쓰고 이유를 설명한다.

| 직접 쓰는 부분 | 배우는 것 |
|---|---|
| 콘텐츠 모델: collections 스키마(Zod), 관계 검사 (§6) | 온톨로지 설계, 스키마와 데이터 검증 |
| 리니지 계산: 역방향 관계, git 이력 추출 (§8.1–8.2) | 그래프 데이터 처리, 빌드 시점 데이터 파이프라인 |
| Worker + R2 (§9.3) | 서버리스, 스토리지, HTTP 캐시와 Range 요청 |
| 타임라인 컴포넌트 (§6.3) | React 상태, 반응형 레이아웃, SVG/CSS |

| Claude가 쓰는 부분 | 설명으로 남기는 것 |
|---|---|
| Astro 뼈대, 설정, CI, 콘텐츠 옮기기 | 왜 이 설정인지 |
| 그림 키트, anatomy 그림 2개, PyCell | 컴포넌트 구조와 island 로딩 |
| Keynote 변환 스크립트 | 스크립트 흐름 |

- 계획서의 각 작업에 `[직접]` / `[Claude]` 표시와 "배울 개념" 한 줄을 붙인다.

사이트 주인의 현재 수준 (2026-11-21 본인 답): TypeScript, Zod, React, Cloudflare Workers, 그래프 처리는 **처음**. git은 익숙, CSS는 써 봄.

그래서 `[직접]` 작업은 이렇게 준다.

1. **개념 노트 먼저.** 작업마다 그 작업에 필요한 개념만 짧게 설명한다 (예: "Zod 스키마는 데이터의 모양을 코드로 적은 것이다", "Worker는 요청 하나를 받아 응답 하나를 돌려주는 함수다"). 이 노트가 그대로 `kind: build` Study 기록의 초안이 된다.
2. **뼈대 파일.** 타입, 함수 이름과 인자, 각 함수가 할 일을 적은 주석, 비어 있는 본문(`// TODO`)까지 Claude가 쓴다. 사이트 주인은 본문을 채운다.
3. **먼저 실패하는 테스트.** 통과 기준이다. 테스트 이름이 곧 요구사항 목록이 되게 쓴다.
4. **작게 나눈다.** `[직접]` 작업 하나는 함수 하나 또는 컴포넌트 하나 정도. 한 번에 1~2시간 안에 끝나는 크기.
5. **막히면 힌트 단계.** 바로 답을 주지 않고 힌트 → 비슷한 예시 → 답 순서로 준다. 답을 받은 경우는 Study 기록에 "막힌 곳"으로 남긴다.
6. **리뷰.** 테스트 통과 후 Claude가 리뷰하고, 사이트 주인이 그 코드가 왜 그렇게 동작하는지 한두 문장으로 설명해 보는 것으로 마친다.

- git은 익숙하므로 브랜치, 커밋, PR은 사이트 주인이 직접 한다. CSS는 써 봤으므로 타임라인의 반응형 레이아웃(CSS)은 힌트만 주고, React 부분에 뼈대를 더 준다.
- 처음 배우는 것이 많으므로 2단계(콘텐츠 모델) 앞에 TypeScript 기초를 이 프로젝트 코드로 익히는 짧은 연습 작업 하나를 둔다.
- 각 단계를 마치면 `kind: build` Study 기록을 하나 쓴다. 이 기록들이 원칙과 리니지로 연결되면서 이 사이트가 첫 번째 사례가 된다.

## 12. 단계

| 단계 | 내용 | 끝났다는 기준 |
|---|---|---|
| 1 | Astro 뼈대, 토큰, i18n 라우팅, CI, `/cv`·`/blog` 옮기기, 리다이렉트 | workers.dev에서 CV와 옛 글이 영어/한국어 경로로 열림. 검사 전부 통과 |
| 2 | 콘텐츠 모델과 검사 `[직접]`, 경험 데이터 입력 | 모든 경험이 스키마를 통과, 잘못된 slug에서 빌드 실패 |
| 3 | 첫 화면 타임라인 `[직접]` | 데스크톱 가로, 모바일 세로. 360px 폭에서 가로 스크롤 없음 |
| 4 | 경험 페이지 틀, 그림 키트, Hiconsy·시대인재 본문 | 두 딥다이브 페이지가 8단계와 Then/Now를 갖춤 |
| 5 | Principles, Study, 리니지·History `[직접]`, PyCell | 원칙 페이지에 위·아래 연결과 git 이력 표시, CI에서도 같음 |
| 6 | anatomy 그림 2개 | 두 딥다이브의 첫 그림 교체 |
| 7 | Keynote 변환, Worker + R2 `[직접]`, 전시 벽 | Tesla Jr. 한 덱이 재생, 공개 목록 밖 경로는 404. 나머지 덱은 보류 |
| 8 | 디자인 세션 (색, 글꼴, 간격, 움직임) | 토큰만 바꿔 적용. AI 티 점검 |
| 9 | 도메인 구매, 옛 github.io 사이트 리다이렉트, 옛 레포 보관 | 옛 주소가 새 사이트로 이동. 보관 전 따로 확인 |

1–3단계는 순서대로. 4·5·6·7은 3 이후 병행 가능. 디자인 세션(8)은 언제든 가능하며, 그 전까지는 중립 토큰으로 진행한다.

## 13. 아직 정하지 않은 것 (콘텐츠)

빌드를 막지 않는다. 정해지면 콘텐츠만 고친다.

- 시대인재 시기 프로젝트들의 실제 기간 (지금은 2023–2025 임시값).
- Tesla Jr. 다음에 올릴 덱의 순서.

정해진 것 (2026-11-21): Hiconsy 시작 2025-06, 이메일 공개, 학점 비공개, 덱은 모두 공개 가능하나 한 덱부터, 개인 볼트는 연결하지 않고 골라서 옮김.

회사 표기 (2026-11-21 본인 확인): ㈜하이컨시가 모회사, 시대인재가 자회사. 두 경험은 따로 둔다.

| 경험 | 회사 | 역할 성격 |
|---|---|---|
| SDIJ Forest | 시대인재 (Sidae Injae) | 기획 + 개발 |
| Hiconsy 강의 ASR | ㈜하이컨시 (Hiconsy Inc.) | ML 엔지니어 |

회사 소개에는 매출을 넣지 않는다. 소개문은 출처가 있는 사실만 쓰고 최상급 표현("가장 큰")은 쓰지 않는다. `resume.json`의 Hiconsy 설명("subsidiary")은 1단계에서 고친다.

승인된 회사 소개문 (영어판 딥다이브 페이지 맨 위에 한 번만. 한국어판은 한 줄):

> **Sidae Injae** — In Korea, admission to most universities depends largely on one national exam, the CSAT, held once a year. Many students study for it at private academies after school, and some spend an extra year preparing to take it again. Sidae Injae is one of these academies. It opened in 2014 in Daechi-dong, the Seoul neighborhood where many of them are based. Its students have included perfect scorers on the CSAT.

> **Hiconsy Inc.** — Hiconsy is the parent company of Sidae Injae. It produces the study materials and builds the internal software that the academy runs on. I worked on its AI R&D team.

## 14. 만드는 사람에게 맡기는 것

- 폴더 구조 세부(`src/components/figures/` 등), 파일 이름.
- 테스트 도구는 Vitest 유지. Astro 컴포넌트 테스트 방식 선택.
- Pyodide 버전, anatomy 그림의 세부 부품 구성.
- 검색 기능(Pagefind 등)은 콘텐츠가 늘어난 뒤 필요하면 추가.
