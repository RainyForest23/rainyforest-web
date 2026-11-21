# 1단계: 왜 이렇게 했나

1단계에서 Claude가 맡은 부분을 왜 그렇게 만들었는지 적어 둔 노트다. 코드를 읽다가 "이건 왜 있지?" 싶을 때 여기를 본다.

## Next.js를 걷어낸 이유

이 사이트는 글과 그림이 대부분이고, 방문자마다 다른 내용을 보여 줄 일이 없다. 그래서 서버가 요청마다 일을 할 필요가 없다. Next.js는 서버에서 일을 많이 하는 앱에 맞춰진 도구라서, 정적인 사이트에는 설정과 규칙이 필요 이상으로 많았다. Astro는 "빌드할 때 HTML을 전부 만들어 두고, 움직이는 부분만 따로 싣는다"를 기본으로 하는 도구다. 같은 일을 더 적은 설정으로 한다.

## `dist/`가 무엇인가

`npm run build`를 하면 Astro가 `src/pages/`의 파일을 하나씩 실행해서 HTML 파일로 바꾸고, `dist/` 폴더에 모은다. `src/pages/index.astro`는 `dist/index.html`이 되고, `src/pages/cv/index.astro`는 `dist/cv/index.html`이 된다. `public/`의 파일은 그대로 복사된다. `dist/`는 빌드할 때마다 새로 만들어지므로 git에 올리지 않는다.

이렇게 미리 만들어 두는 도구를 정적 사이트 생성기라고 부른다. 방문자가 올 때는 이미 만들어진 파일을 보내기만 하면 된다.

## Cloudflare Workers가 이 폴더를 내보내는 방식

`wrangler.jsonc`의 `assets.directory`가 `./dist`를 가리킨다. `npx wrangler deploy`를 하면 이 폴더의 파일이 Cloudflare로 올라가고, 전 세계 서버가 주소에 맞는 파일을 찾아서 보낸다. 우리가 쓴 코드는 한 줄도 실행되지 않는다. 그래서 요청 수에 따른 요금이 없다.

- `/cv/` 요청 → `dist/cv/index.html` (`html_handling: auto-trailing-slash`)
- 없는 주소 → `dist/404.html`을 404 상태로 (`not_found_handling: 404-page`)
- `/_astro/` 아래 파일은 이름에 내용의 해시가 들어 있어서 1년 동안 캐시해도 된다 (`public/_headers`)

Keynote 덱처럼 큰 파일은 이 방식으로 올릴 수 없다 (파일 하나에 25MiB 제한). 그 부분은 7단계에서 R2와 Worker 코드로 따로 만든다.

## `views`와 `pages`를 나눈 이유

Astro는 `src/pages/` 안의 파일 위치가 곧 주소다. `src/pages/cv/index.astro`는 `/cv/`, `src/pages/ko/cv/index.astro`는 `/ko/cv/`가 된다. 영어와 한국어 주소가 둘 다 필요하니 파일도 둘이어야 한다.

같은 화면을 두 번 쓰면 한쪽만 고치는 실수가 생긴다. 그래서 화면 본문은 `src/views/Cv.astro`에 한 번만 쓰고, `locale`(언어)을 받게 했다. `pages` 쪽 파일은 `<Cv locale="en" />` 또는 `<Cv locale="ko" />` 한 줄만 있는 얇은 파일이다.

- 화면에 고정으로 나오는 문구는 `src/i18n/ui.ts` 사전에 있고, `t(locale, 'nav.blog')`처럼 꺼낸다.
- 주소 계산은 `src/i18n/paths.ts`에 모았다. `localePath('ko', '/cv/')`는 `/ko/cv/`를 준다.
- `Base.astro`는 지금 주소를 보고 언어 전환 링크와 `hreflang` 링크를 만든다. `hreflang`은 검색 엔진에 "이 페이지의 한국어판은 저기 있다"고 알려 주는 표시다.
- 라우트 파일이 언어를 잘못 넘기면(`/ko/` 아래에서 `locale="en"`) `Base.astro`가 빌드를 멈춘다.

## `resume.json`을 Zod로 검사하는 이유

CV 내용은 `content/resume.json` 한 파일에 있다. 이 파일을 손으로 고치다 보면 필드 이름을 틀리거나 날짜를 `June 2025`처럼 쓸 수 있다. 그러면 화면이 조용히 비거나 깨진다. 그래서 빌드할 때 "이 JSON이 약속한 모양인가"를 먼저 검사한다. 그 약속을 적은 것이 `src/lib/cv/schema.ts`의 스키마다.

이전 사이트는 Ajv라는 도구를 썼다. Ajv는 검사 규칙과 TypeScript 타입을 따로 써야 해서 같은 내용이 두 번 있었다. Zod는 규칙을 한 번 쓰면 타입이 따라 나온다.

```ts
const resumeSchema = z.strictObject({ basics: z.strictObject({ name: z.string(), ... }) })
type Resume = z.infer<typeof resumeSchema>   // 규칙에서 타입을 뽑는다
```

Astro의 content collection도 Zod를 쓰기 때문에 도구가 하나로 줄었다. 2단계에서 경험·원칙·공부 기록의 스키마를 직접 쓸 때 이 파일이 예시가 된다.

**`strictObject`가 학점을 막는 방식.** `z.object`는 모르는 필드를 그냥 무시하고, `z.strictObject`는 모르는 필드가 있으면 실패한다. 스키마의 `education`에는 `score` 필드가 없다. 그래서 누가 `resume.json`에 `"score": "GPA ..."`를 다시 넣으면 빌드가 멈춘다. "넣지 말자"는 약속을 기억에 맡기지 않고 검사에 맡긴 것이다. 같은 내용을 `schema.test.ts`의 `rejects a GPA score` 테스트가 확인한다.

예전 CV PDF(`public/cv/woorim-shin-cv.pdf`)에는 학점이 적혀 있어서 내렸다. 학점을 뺀 PDF를 같은 자리에 넣고 `Cv.astro`에 내려받기 링크를 다시 달면 된다.

## content collection과 `[slug].astro`

옛 글 18편은 `content/legacy/`에 `.mdx` 파일로 있다. 각 파일 맨 위에는 제목, 날짜, 태그 같은 머리말(frontmatter)이 있다.

**content collection이 하는 일.** `src/content.config.ts`에 "이 폴더의 `.mdx` 파일이 `legacy`라는 묶음이고, 머리말은 이 스키마를 따른다"고 적어 두면 Astro가 빌드할 때 세 가지를 해 준다.

1. 파일을 찾아서 읽는다.
2. 머리말을 스키마(`src/lib/content/legacy.ts`)로 검사한다. 날짜 형식이 틀리거나 영어 요약이 없으면 어느 파일인지 알려 주며 빌드가 멈춘다.
3. `getCollection('legacy')`로 꺼내 쓸 수 있게 하고, 타입도 만들어 준다. 그래서 `post.data.titel`처럼 오타를 내면 편집기가 바로 알려 준다.

**파일 하나가 18개 페이지가 되는 원리.** `src/pages/blog/[slug].astro`의 대괄호는 "이 자리는 값마다 달라진다"는 뜻이다. Astro는 빌드할 때 이 파일의 `getStaticPaths()`를 불러서 "어떤 값들로 페이지를 만들까요?"를 묻는다. 우리는 글 18편의 목록을 돌려준다.

```ts
export async function getStaticPaths() {
  const posts = await getCollection('legacy')
  return posts.map((entry) => ({ params: { slug: entry.id }, props: { entry } }))
}
```

`params.slug`가 주소의 `[slug]` 자리에 들어가고, `props.entry`가 그 페이지에 전달된다. 목록에 18개가 있으니 페이지도 18개가 생긴다. 한국어 쪽(`src/pages/ko/blog/[slug].astro`)도 같은 일을 해서 모두 36개다. 태그 페이지(`tags/[tag].astro`)도 같은 방식이다.

**화면 언어와 글 언어.** 글은 대부분 한국어로만 있다. 영어 주소로 한국어 글을 열면 "Korean only" 안내와 영어 요약이 나오고, 본문에는 `lang="ko"`가 붙는다. 브라우저와 화면 낭독기가 이 표시를 보고 글꼴과 발음을 고른다.

**수식에서 겪은 문제.** 수식 HTML은 `rehype-katex` 안에 들어 있는 KaTeX가 만들고, 모양을 잡는 CSS는 우리가 따로 설치한 `katex`에서 온다. 두 버전이 달랐더니 빌드도 되고 검사도 통과했는데 위첨자와 분수가 겹쳐 보였다. 브라우저로 직접 열어 보고서야 알았다. `package.json`의 `katex`를 같은 버전으로 맞췄고, 다시 어긋나면 `scripts/katex-version.test.ts`가 실패한다. 화면에 보이는 것은 테스트가 통과해도 눈으로 한 번 확인해야 한다.
