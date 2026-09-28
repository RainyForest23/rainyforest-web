import type { ReactNode } from 'react'

export function PageHero({
  eyebrow,
  title,
  lede,
  compact = false,
  lang,
  children,
}: {
  eyebrow: ReactNode
  title: string
  lede?: ReactNode
  /** Smaller headline for long titles such as post names. */
  compact?: boolean
  lang?: string
  children?: ReactNode
}) {
  return (
    <section className={compact ? 'hero hero--compact' : 'hero'}>
      <div className="eyebrow">{eyebrow}</div>
      <h1 lang={lang}>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
      {children}
    </section>
  )
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <h2 className="section-label">
      <span>{children}</span>
      {action}
    </h2>
  )
}
