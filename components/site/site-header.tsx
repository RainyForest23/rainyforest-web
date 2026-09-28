'use client'

import { Classes, Navbar, NavbarDivider, NavbarGroup, NavbarHeading } from '@blueprintjs/core'
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
    <Navbar className={`site-header ${Classes.DARK}`}>
      <NavbarGroup align="left">
        <NavbarHeading>
          <Link href="/" className="site-header__name">
            Woorim Shin
          </Link>
        </NavbarHeading>
      </NavbarGroup>
      <NavbarGroup align="right">
        <NavbarDivider />
        <nav aria-label="Primary">
          {NAV.map((item) => {
            const current = pathname.startsWith(item.href)
            return (
              // Next's Link keeps client-side navigation; Blueprint's classes give it the button look.
              <Link
                key={item.href}
                href={item.href}
                className={`site-header__item ${Classes.BUTTON} ${Classes.MINIMAL} ${current ? Classes.ACTIVE : ''}`}
                aria-current={current ? 'page' : undefined}
              >
                <span className={Classes.BUTTON_TEXT}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </NavbarGroup>
    </Navbar>
  )
}
