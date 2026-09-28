'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/cv/', label: 'CV' },
  { href: '/projects/', label: 'Projects' },
  { href: '/blog/', label: 'Blog' },
]

export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className="site-header">
      <Link href="/" className="site-header__name">
        Woorim Shin
      </Link>
      <nav aria-label="Primary" className="site-header__nav">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="site-header__item"
            aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
