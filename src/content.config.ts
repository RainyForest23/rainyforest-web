// content collection 설정. Astro가 빌드할 때 이 파일을 읽어서
// content/ 아래 파일을 찾고, 스키마로 검사하고, 타입을 만들어 준다.
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { legacySchema } from './lib/content/legacy'

const legacy = defineCollection({
  // base는 프로젝트 루트 기준이다. redirects.json은 .mdx가 아니라서 걸리지 않는다.
  loader: glob({
    pattern: '*.mdx',
    base: './content/legacy',
    // 글의 id = 파일 이름에서 확장자를 뺀 것. 이 id가 주소(/blog/<id>/)가 된다.
    generateId: ({ entry }) => entry.replace(/\.mdx$/, ''),
  }),
  schema: legacySchema,
})

export const collections = { legacy }
