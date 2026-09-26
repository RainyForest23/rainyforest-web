import type { Metadata } from 'next'
import { Section } from '@/components/site/section'
import { formatPeriod } from '@/lib/content/format'
import { loadProjects } from '@/lib/content/projects'
import { loadResume } from '@/lib/cv/resume'

export const metadata: Metadata = {
  title: 'CV — Woorim Shin',
  description: 'Education, experience, publications and talks.',
}

export default function CvPage() {
  const resume = loadResume()
  const featured = loadProjects().filter((project) => project.featured)

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-3xl font-semibold">{resume.basics.name}</h1>
          <p className="mt-1 text-fg-muted">{resume.basics.label}</p>
        </div>
        <a href="/cv/woorim-shin-cv.pdf" className="text-sm underline">
          Download PDF
        </a>
      </div>
      <p className="mt-6">{resume.basics.summary}</p>

      <Section title="Education">
        {resume.education.map((entry) => (
          <div key={entry.institution} className="mt-4 first:mt-0">
            <p className="font-medium">
              {entry.studyType}, {entry.area}
            </p>
            <p className="text-sm text-fg-muted">
              {entry.institution} — {formatPeriod({ start: entry.startDate, end: entry.endDate })}
              {entry.score ? ` — ${entry.score}` : ''}
            </p>
            {entry.courses?.length ? (
              <p className="mt-1 text-sm text-fg-muted">Coursework: {entry.courses.join(', ')}</p>
            ) : null}
          </div>
        ))}
      </Section>

      <Section title="Experience">
        {resume.work.map((job) => (
          <div key={`${job.name}-${job.startDate}`} className="mt-6 first:mt-0">
            <p className="font-medium">
              {job.position} — {job.name}
            </p>
            <p className="text-sm text-fg-muted">
              {job.location ? `${job.location} — ` : ''}
              {formatPeriod({ start: job.startDate, end: job.endDate })}
            </p>
            <ul className="mt-2 list-disc pl-5">
              {job.highlights.map((line) => (
                <li key={line} className="mt-1">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Publications">
        {resume.publications.map((paper) => (
          <div key={paper.name} className="mt-4 first:mt-0">
            <p className="font-medium">{paper.name}</p>
            <p className="text-sm text-fg-muted">
              {paper.publisher} — {paper.releaseDate}
            </p>
            <p className="mt-1 text-sm">{paper.summary}</p>
          </div>
        ))}
      </Section>

      <Section title="Selected projects">
        <ul className="list-disc pl-5">
          {featured.map((project) => (
            <li key={project.slug} className="mt-1">
              <a href={`/projects/${project.slug}/`} className="underline">
                {project.title}
              </a>{' '}
              <span className="text-fg-muted">— {project.summary}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Talks">
        {resume.talks.map((talk) => (
          <div key={talk.title} className="mt-4 first:mt-0">
            <p className="font-medium">
              {talk.title}
              {talk.slides ? (
                <>
                  {' '}
                  <a href={talk.slides} className="text-sm underline">
                    (slides)
                  </a>
                </>
              ) : null}
            </p>
            <p className="text-sm text-fg-muted">
              {talk.venue} — {formatPeriod({ start: talk.startDate, end: talk.endDate })}
            </p>
          </div>
        ))}
      </Section>

      <Section title="Awards">
        <ul className="list-disc pl-5">
          {resume.awards.map((award) => (
            <li key={award.title} className="mt-1">
              {award.title} <span className="text-fg-muted">({award.date})</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Skills">
        {resume.skills.map((group) => (
          <p key={group.name} className="mt-2 first:mt-0">
            <span className="font-medium">{group.name}:</span>{' '}
            <span className="text-fg-muted">{group.keywords.join(', ')}</span>
          </p>
        ))}
      </Section>

      <Section title="Languages">
        <p className="text-fg-muted">
          {resume.languages.map((l) => `${l.language} (${l.fluency})`).join(', ')}
        </p>
      </Section>
    </main>
  )
}
