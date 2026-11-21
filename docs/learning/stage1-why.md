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
