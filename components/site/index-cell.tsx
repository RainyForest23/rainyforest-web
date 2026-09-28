import Link from 'next/link'
import { ArrowRight, Card } from '@/components/bp'

/** A cell of the home page's index grid, built on Blueprint's interactive Card. */
export function IndexCell({
  num,
  href,
  title,
  desc,
}: {
  num: string
  href: string
  title: string
  desc: string
}) {
  return (
    <Link href={href} aria-label={title}>
      <Card interactive className="index-cell">
        <span className="index-cell__num">{num}</span>
        <ArrowRight className="index-cell__arrow" size={20} />
        <h2 className="index-cell__title">{title}</h2>
        <p className="index-cell__desc">{desc}</p>
      </Card>
    </Link>
  )
}
