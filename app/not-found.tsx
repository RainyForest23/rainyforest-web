import Link from 'next/link'
import { PageHero } from '@/components/site/page-hero'

export default function NotFound() {
  return (
    <PageHero eyebrow="404" title="Page not found" lede={<Link href="/" className="underline underline-offset-4">Go to the home page</Link>} />
  )
}
