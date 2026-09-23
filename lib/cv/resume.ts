import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { type Resume, resumeSchema } from './schema'

const RESUME_PATH = join(process.cwd(), 'content/resume.json')

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile(resumeSchema)

export function validateResume(data: unknown): string[] {
  if (validate(data)) return []
  return (validate.errors ?? []).map((e) => `resume${e.instancePath} ${e.message ?? 'is invalid'}`)
}

export function loadResume(): Resume {
  const data = JSON.parse(readFileSync(RESUME_PATH, 'utf8'))
  const errors = validateResume(data)
  if (errors.length > 0) {
    throw new Error(`content/resume.json is invalid:\n  ${errors.join('\n  ')}`)
  }
  return data as Resume
}
