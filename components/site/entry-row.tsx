import Link from 'next/link'
import type { ReactNode } from 'react'

export interface EntryTag {
  label: string
  href?: string
}

/** One row of a dated list: date column, linked title, summary, optional note and tags. */
export function EntryRow({
  date,
  href,
  title,
  summary,
  note,
  tags = [],
  lang,
}: {
  date: ReactNode
  href: string
  title: string
  summary?: string
  note?: string
  tags?: EntryTag[]
  lang?: string
}) {
  return (
    <li className="entry-row">
      <span className="entry-date">{date}</span>
      <Link href={href} lang={lang}>
        <h3 className="entry-title">{title}</h3>
      </Link>
      {summary ? <p className="entry-summary">{summary}</p> : null}
      {note ? <p className="entry-note">{note}</p> : null}
      {tags.length > 0 ? (
        <div className="entry-tags">
          {tags.map((tag) =>
            tag.href ? (
              <Link key={tag.label} href={tag.href} className="entry-tag">
                {tag.label}
              </Link>
            ) : (
              <span key={tag.label} className="entry-tag">
                {tag.label}
              </span>
            ),
          )}
        </div>
      ) : null}
    </li>
  )
}
