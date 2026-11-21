import { getViteConfig } from 'astro/config'

// Astro의 Vite 설정을 그대로 쓴다. 테스트는 src/lib와 scripts의 순수 함수만 다룬다.
export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
