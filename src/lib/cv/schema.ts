// content/resume.json의 모양을 정한 Zod 스키마.
// 모든 객체가 strictObject라서, 여기에 없는 필드가 JSON에 있으면 빌드가 실패한다.
// 학점(score) 필드를 일부러 정의하지 않았다. 누가 다시 넣어도 공개되지 않게 하려는 것이다.
import { z } from 'astro/zod'

/** 'YYYY', 'YYYY-MM', 'YYYY-MM-DD' 또는 'Present' */
const date = z.string().regex(/^(\d{4}(-\d{2}(-\d{2})?)?|Present)$/, 'use YYYY, YYYY-MM, YYYY-MM-DD or Present')
const strings = z.array(z.string())

const keywordGroup = z.strictObject({ name: z.string(), keywords: strings })

export const resumeSchema = z.strictObject({
  basics: z.strictObject({
    name: z.string(),
    label: z.string(),
    email: z.email(),
    summary: z.string(),
    location: z
      .strictObject({
        city: z.string().optional(),
        region: z.string().optional(),
        countryCode: z.string().optional(),
      })
      .optional(),
    profiles: z.array(z.strictObject({ network: z.string(), username: z.string(), url: z.url() })).optional(),
  }),
  education: z.array(
    z.strictObject({
      institution: z.string(),
      area: z.string(),
      studyType: z.string(),
      startDate: date,
      endDate: date.optional(),
      courses: strings.optional(),
      summary: z.string().optional(),
    }),
  ),
  work: z.array(
    z.strictObject({
      name: z.string(),
      position: z.string(),
      location: z.string().optional(),
      startDate: date,
      endDate: date.optional(),
      highlights: strings,
    }),
  ),
  publications: z.array(
    z.strictObject({ name: z.string(), publisher: z.string(), releaseDate: date, summary: z.string() }),
  ),
  talks: z.array(
    z.strictObject({
      title: z.string(),
      venue: z.string(),
      startDate: date,
      endDate: date.optional(),
      highlights: strings,
      slides: z.string().optional(),
    }),
  ),
  awards: z.array(
    z.strictObject({
      title: z.string(),
      date: date,
      awarder: z.string().optional(),
      summary: z.string().optional(),
    }),
  ),
  skills: z.array(keywordGroup),
  languages: z.array(z.strictObject({ language: z.string(), fluency: z.string() })),
  interests: z.array(keywordGroup).optional(),
  /** 일부러 비워 둔다. 프로젝트는 경험 페이지에서 다룬다. */
  projects: z.array(z.never()).max(0).optional(),
})

export type Resume = z.infer<typeof resumeSchema>
