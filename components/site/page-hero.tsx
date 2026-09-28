import type { ReactNode } from 'react'

export function PageHero({
  overline,
  title,
  lede,
  children,
}: {
  overline: string
  title: string
  lede?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="hero">
      <div className="overline">{overline}</div>
      <h1>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
      {children}
    </section>
  )
}
