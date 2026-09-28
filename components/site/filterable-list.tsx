'use client'

import { InputGroup, SegmentedControl } from '@blueprintjs/core'
import { Search } from '@blueprintjs/icons'
import { useMemo, useState } from 'react'
import { type EntryTag, EntryRow } from './entry-row'

export interface ListItem {
  key: string
  date: string
  href: string
  title: string
  summary?: string
  note?: string
  tags: EntryTag[]
  lang?: string
  /** Matched against the segmented control's value; "all" shows everything. */
  group: string
}

const ALL = 'all'

/** A dated list with Blueprint's search field and segmented filter. Works as plain HTML before hydration. */
export function FilterableList({
  items,
  groups,
  placeholder,
  noun,
}: {
  items: ListItem[]
  groups: { label: string; value: string }[]
  placeholder: string
  noun: [singular: string, plural: string]
}) {
  const [group, setGroup] = useState(ALL)
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (group !== ALL && item.group !== group) return false
      if (!q) return true
      const haystack = [item.title, item.summary, item.note, ...item.tags.map((t) => t.label)]
      return haystack.some((text) => text?.toLowerCase().includes(q))
    })
  }, [items, group, query])

  return (
    <>
      <div className="filter-bar">
        <InputGroup
          type="search"
          size="large"
          leftIcon={<Search />}
          placeholder={placeholder}
          value={query}
          onValueChange={setQuery}
          aria-label={placeholder}
        />
        <SegmentedControl
          size="large"
          options={[{ label: 'All', value: ALL }, ...groups]}
          value={group}
          onValueChange={setGroup}
        />
      </div>
      <p className="filter-status" aria-live="polite">
        {visible.length} {visible.length === 1 ? noun[0] : noun[1]}
      </p>
      {visible.length > 0 ? (
        <ul>
          {visible.map(({ key, group: _group, ...item }) => (
            <EntryRow key={key} {...item} />
          ))}
        </ul>
      ) : (
        <p className="entry-empty">Nothing matches. Try another word or filter.</p>
      )}
    </>
  )
}
