# rainyforest-web

개인 사이트. Astro 7 정적 사이트를 Cloudflare Workers 정적 에셋으로 내보낸다.

- 설계: `docs/superpowers/specs/2026-11-21-site-rebuild-design.md`
- 단계별 계획: `docs/superpowers/plans/`
- 학습 노트: `docs/learning/`

## 코드를 쓰기 전에

- **Astro 7 API는 학습 데이터와 다를 수 있다.** Astro 코드를 쓰기 전에 docs.astro.build 또는 `node_modules/astro/dist/types/`에서 확인한다. 설정 파일은 `src/content.config.ts`, `z`는 `astro/zod`, `render(entry)`는 `astro:content`, Markdown 플러그인은 `@astrojs/markdown-remark`의 `unified()`.
- **계획서에서 `[직접]`으로 표시한 작업은 대신 구현하지 않는다.** 사이트 주인이 풀스택을 공부하려고 직접 쓰는 부분이다. 개념 노트, 뼈대 파일, 먼저 실패하는 테스트만 만들고 멈춘다. 막히면 힌트 → 비슷한 예시 → 답 순서로 돕는다 (spec §11).
- 색과 px 값은 `src/styles/tokens.css`에만 쓴다. 다른 파일에 쓰면 `npm run check:tokens`가 실패한다.
- Tailwind와 shadcn/ui는 쓰지 않는다. 스타일은 `.astro` 파일의 `<style>`과 CSS 변수로.
- 내부 링크는 모두 `/`로 끝난다. 영어가 기본(`/`), 한국어는 `/ko/`.
- 한국어 문장은 쉬운 말로 쓴다.

## 공개 범위 (spec §3)

- 학점(GPA)은 어디에도 넣지 않는다. 이메일은 공개한다.
- 회사(Hiconsy, 시대인재) 일은 구조와 확인된 수치만 쓴다. 코드, 데이터, 실제 강의 문장, 내부 화면은 넣지 않는다. 예시 자막은 지어낸 것만.
- 확인된 수치만 쓴다. LLM 벤치마크는 3종.
- 면접 내용은 Study 기록에 넣지 않는다.

## 명령

```bash
npm run dev      # http://localhost:4321
npm run verify   # CI가 하는 검사 전부
npm run preview  # 빌드한 dist/를 Workers와 같은 방식으로 열어 봄 (먼저 npm run build)
```

PR은 merge commit으로 합친다 (squash 금지: Principles의 History가 커밋 기록을 읽는다).
