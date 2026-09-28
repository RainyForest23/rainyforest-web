import Link from 'next/link'
import type { ReactNode } from 'react'
import { Tag } from '@/components/bp'

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
      <Link href={href}>
        <h3 className="entry-title" lang={lang}>
          {title}
        </h3>
      </Link>
      {summary ? <p className="entry-summary">{summary}</p> : null}
      {note ? <p className="entry-note">{note}</p> : null}
      {tags.length > 0 ? <EntryTags tags={tags} /> : null}
    </li>
  )
}

export function EntryTags({ tags }: { tags: EntryTag[] }) {
  return (
    <div className="entry-tags">
      {tags.map((tag) =>
        tag.href ? (
          <Link key={tag.label} href={tag.href} className="bp6-tag bp6-minimal bp6-interactive">
            <span className="bp6-text-overflow-ellipsis bp6-fill">{tag.label}</span>
          </Link>
        ) : (
          <Tag key={tag.label} minimal>
            {tag.label}
          </Tag>
        ),
      )}
    </div>
  )
}
