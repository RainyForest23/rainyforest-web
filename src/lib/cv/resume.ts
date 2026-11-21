import { readFileSync } from 'node:fs'
import { type Resume, resumeSchema } from './schema'

const RESUME_FILE = 'content/resume.json'

/** 검사에 실패하면 어느 필드가 틀렸는지 줄마다 적어서 던진다. */
export function parseResume(data: unknown): Resume {
  const result = resumeSchema.safeParse(data)
  if (result.success) return result.data
  const problems = result.error.issues.map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  throw new Error(`${RESUME_FILE} is invalid:\n${problems.join('\n')}`)
}

/** 빌드할 때 한 번 읽는다. 경로는 프로젝트 루트 기준이다. */
export function loadResume(): Resume {
  return parseResume(JSON.parse(readFileSync(RESUME_FILE, 'utf8')))
}
