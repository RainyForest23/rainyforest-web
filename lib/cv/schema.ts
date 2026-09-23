export interface DateRange {
  startDate: string
  endDate?: string
}

export interface Resume {
  basics: {
    name: string
    label: string
    email: string
    summary: string
    location?: { city?: string; region?: string; countryCode?: string }
    profiles?: { network: string; username: string; url: string }[]
  }
  education: (DateRange & {
    institution: string
    area: string
    studyType: string
    score?: string
    courses?: string[]
    summary?: string
  })[]
  work: (DateRange & {
    name: string
    position: string
    location?: string
    highlights: string[]
  })[]
  publications: {
    name: string
    publisher: string
    releaseDate: string
    summary: string
  }[]
  talks: (DateRange & {
    title: string
    venue: string
    highlights: string[]
    slides?: string
  })[]
  awards: { title: string; date: string; awarder?: string; summary?: string }[]
  skills: { name: string; keywords: string[] }[]
  languages: { language: string; fluency: string }[]
  interests?: { name: string; keywords: string[] }[]
  /** Intentionally empty: portfolio projects live in content/projects (spec §5.1). */
  projects?: never[]
}

// Not `as const`: Ajv's compile() rejects deeply readonly schema objects.
const DATE = { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2}|\\d{4}|Present)$' }
const STRINGS = { type: 'array', items: { type: 'string' } }

export const resumeSchema = {
  type: 'object',
  required: ['basics', 'education', 'work', 'publications', 'talks', 'awards', 'skills', 'languages'],
  additionalProperties: false,
  properties: {
    basics: {
      type: 'object',
      required: ['name', 'label', 'email', 'summary'],
      properties: {
        name: { type: 'string' },
        label: { type: 'string' },
        email: { type: 'string', format: 'email' },
        summary: { type: 'string' },
        location: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            region: { type: 'string' },
            countryCode: { type: 'string' },
          },
        },
        profiles: {
          type: 'array',
          items: {
            type: 'object',
            required: ['network', 'username', 'url'],
            properties: {
              network: { type: 'string' },
              username: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        required: ['institution', 'area', 'studyType', 'startDate'],
        properties: {
          institution: { type: 'string' },
          area: { type: 'string' },
          studyType: { type: 'string' },
          startDate: DATE,
          endDate: DATE,
          score: { type: 'string' },
          courses: STRINGS,
          summary: { type: 'string' },
        },
      },
    },
    work: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'position', 'startDate', 'highlights'],
        properties: {
          name: { type: 'string' },
          position: { type: 'string' },
          location: { type: 'string' },
          startDate: DATE,
          endDate: DATE,
          highlights: STRINGS,
        },
      },
    },
    publications: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'publisher', 'releaseDate', 'summary'],
        properties: {
          name: { type: 'string' },
          publisher: { type: 'string' },
          releaseDate: DATE,
          summary: { type: 'string' },
        },
      },
    },
    talks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'venue', 'startDate', 'highlights'],
        properties: {
          title: { type: 'string' },
          venue: { type: 'string' },
          startDate: DATE,
          endDate: DATE,
          highlights: STRINGS,
          slides: { type: 'string' },
        },
      },
    },
    awards: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'date'],
        properties: {
          title: { type: 'string' },
          date: DATE,
          awarder: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'keywords'],
        properties: { name: { type: 'string' }, keywords: STRINGS },
      },
    },
    languages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['language', 'fluency'],
        properties: { language: { type: 'string' }, fluency: { type: 'string' } },
      },
    },
    interests: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'keywords'],
        properties: { name: { type: 'string' }, keywords: STRINGS },
      },
    },
    projects: { type: 'array', maxItems: 0 },
  },
}
