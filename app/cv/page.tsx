import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AnchorButton, Download, Envelope, GitRepo, LinkIcon } from '@/components/bp'
import { EntryTags } from '@/components/site/entry-row'
import { PageHero, SectionLabel } from '@/components/site/page-hero'
import { formatPeriodCompact } from '@/lib/content/format'
import { loadProjects } from '@/lib/content/projects'
import { loadResume } from '@/lib/cv/resume'

export const metadata: Metadata = {
  title: 'CV — Woorim Shin',
  description: 'Education, experience, publications and talks.',
}

function Row({ period, title, sub, children }: { period: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <li className="cv-row">
      <span className="cv-period">{period}</span>
      <div>
        <div className="cv-title">{title}</div>
        {sub ? <p className="cv-sub">{sub}</p> : null}
        {children}
      </div>
    </li>
  )
}

export default function CvPage() {
  const resume = loadResume()
  const featured = loadProjects().filter((project) => project.featured)
  const { basics } = resume

  return (
    <>
      <PageHero eyebrow="01 · CV" title={basics.name} lede={basics.summary}>
        <div className="link-row">
          <AnchorButton href="/cv/woorim-shin-cv.pdf" icon={<Download />} intent="primary">
            Download PDF
          </AnchorButton>
          <AnchorButton href={`mailto:${basics.email}`} icon={<Envelope />} variant="outlined">
            {basics.email}
          </AnchorButton>
          {basics.profiles?.map((profile) => (
            <AnchorButton
              key={profile.network}
              href={profile.url}
              icon={profile.network === 'GitHub' ? <GitRepo /> : <LinkIcon />}
              variant="outlined"
            >
              {profile.network}
            </AnchorButton>
          ))}
        </div>
      </PageHero>

      <SectionLabel>Experience</SectionLabel>
      <ul>
        {resume.work.map((job) => (
          <Row
            key={`${job.name}-${job.startDate}`}
            period={formatPeriodCompact({ start: job.startDate, end: job.endDate })}
            title={job.position}
            sub={[job.name, job.location].filter(Boolean).join(' · ')}
          >
            <ul className="cv-detail">
              {job.highlights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Row>
        ))}
      </ul>

      <SectionLabel>Education</SectionLabel>
      <ul>
        {resume.education.map((entry) => (
          <Row
            key={entry.institution}
            period={formatPeriodCompact({ start: entry.startDate, end: entry.endDate })}
            title={`${entry.studyType}, ${entry.area}`}
            sub={[entry.institution, entry.score].filter(Boolean).join(' · ')}
          >
            {entry.courses?.length ? <p className="cv-detail">Coursework: {entry.courses.join(', ')}</p> : null}
          </Row>
        ))}
      </ul>

      <SectionLabel>Publications</SectionLabel>
      <ul>
        {resume.publications.map((paper) => (
          <Row key={paper.name} period={paper.releaseDate} title={paper.name} sub={paper.publisher}>
            <p className="cv-detail">{paper.summary}</p>
          </Row>
        ))}
      </ul>

      <SectionLabel action={<Link href="/projects/">All projects</Link>}>Selected projects</SectionLabel>
      <ul>
        {featured.map((project) => (
          <Row
            key={project.slug}
            period={formatPeriodCompact(project.period)}
            title={
              <Link href={`/projects/${project.slug}/`} className="hover:underline hover:underline-offset-4">
                {project.title}
              </Link>
            }
            sub={project.summary}
          />
        ))}
      </ul>

      <SectionLabel>Talks</SectionLabel>
      <ul>
        {resume.talks.map((talk) => (
          <Row
            key={talk.title}
            period={formatPeriodCompact({ start: talk.startDate, end: talk.endDate })}
            title={
              talk.slides ? (
                <a href={talk.slides} className="hover:underline hover:underline-offset-4">
                  {talk.title}
                </a>
              ) : (
                talk.title
              )
            }
            sub={talk.venue}
          />
        ))}
      </ul>

      <SectionLabel>Awards</SectionLabel>
      <ul>
        {resume.awards.map((award) => (
          <Row key={award.title} period={award.date} title={award.title} />
        ))}
      </ul>

      <SectionLabel>Skills</SectionLabel>
      <ul>
        {resume.skills.map((group) => (
          <Row key={group.name} period={group.name} title={<EntryTags tags={group.keywords.map((label) => ({ label }))} />} />
        ))}
      </ul>

      <SectionLabel>Languages</SectionLabel>
      <ul>
        {resume.languages.map((l) => (
          <Row key={l.language} period={l.language} title={l.fluency} />
        ))}
      </ul>
    </>
  )
}
