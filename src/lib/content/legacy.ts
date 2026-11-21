// 옛 블로그 글(content/legacy/*.mdx)의 머리말(frontmatter) 규칙과, 글 목록을 다루는 함수들.
import { z } from 'astro/zod'

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// YAML에서 `date: 2026-04-14`처럼 따옴표 없이 쓰면 문자열이 아니라 UTC 자정의 Date가 된다.
// 그 Date를 빌드 컴퓨터의 시간대로 꺼내면 하루 밀릴 수 있어서, UTC 기준으로 다시 문자열로 바꾼다.
const day = z.union([
  z.string().regex(ISO_DATE, 'use YYYY-MM-DD'),
  z.date().transform((value) => value.toISOString().slice(0, 10)),
])

export const legacySchema = z.object({
  title: z.string().min(1),
  /** 한국어 글도 영어 요약은 꼭 있어야 한다. 영어 화면과 RSS가 쓴다. */
  summary_en: z.string().min(1),
  /** 글이 쓰인 언어 */
  lang: z.enum(['ko', 'en']),
  date: day,
  updated: day.optional(),
  tags: z.array(z.string().regex(KEBAB, 'tags are lowercase kebab-case')).default([]),
})

export type LegacyData = z.infer<typeof legacySchema>

/** 날짜가 새로운 글이 먼저. 같은 날이면 id의 알파벳 순서. 받은 배열은 바꾸지 않는다. */
export function sortPosts<T extends { id: string; data: { date: string } }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => b.data.date.localeCompare(a.data.date) || a.id.localeCompare(b.id))
}

/** 태그 → 그 태그가 붙은 글 목록. 태그는 알파벳 순서, 글은 sortPosts 순서. */
export function tagIndex<T extends { id: string; data: { date: string; tags: string[] } }>(
  posts: T[],
): Map<string, T[]> {
  const byTag = new Map<string, T[]>()
  for (const post of sortPosts(posts)) {
    for (const tag of post.data.tags) {
      byTag.set(tag, [...(byTag.get(tag) ?? []), post])
    }
  }
  return new Map([...byTag].sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * 같은 글의 다른 언어판 id. 옛 글은 한국어판 이름 끝에 '-ko'를 붙여 두었다.
 *   translationOf('x', ['x', 'x-ko']) → 'x-ko',  translationOf('x-ko', ['x', 'x-ko']) → 'x'
 */
export function translationOf(id: string, ids: string[]): string | undefined {
  const twin = id.endsWith('-ko') ? id.slice(0, -'-ko'.length) : `${id}-ko`
  return ids.includes(twin) ? twin : undefined
}
