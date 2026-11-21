// Astro 7 설정. 옵션을 바꾸기 전에 docs.astro.build의 configuration reference를 확인한다.
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import { unified } from '@astrojs/markdown-remark'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

export default defineConfig({
  // 빌드할 때 SITE_URL을 주지 않으면 사이트맵과 RSS에 localhost 주소가 들어간다.
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  // 모든 주소가 /로 끝난다. wrangler.jsonc의 html_handling과 짝이다.
  trailingSlash: 'always',
  build: { format: 'directory' },
  // 영어는 /, 한국어는 /ko/.
  i18n: {
    locales: ['en', 'ko'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  markdown: {
    // Astro 7의 기본 처리기는 Sätteri다. remark/rehype 플러그인(수식)을 쓰려고 unified를 고른다.
    // 표·각주(gfm)는 기본으로 켜져 있다. 옛 글의 따옴표와 줄표를 바꾸지 않도록 smartypants는 끈다.
    // .mdx 파일도 이 설정을 물려받는다 (@astrojs/mdx의 extendMarkdownConfig 기본값).
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
      smartypants: false,
    }),
  },
  integrations: [
    mdx(),
    sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', ko: 'ko' } } }),
  ],
})
