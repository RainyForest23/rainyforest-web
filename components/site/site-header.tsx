import Link from 'next/link'

const NAV = [
  { href: '/cv/', label: 'CV' },
  { href: '/projects/', label: 'Projects' },
  { href: '/blog/', label: 'Blog' },
]

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-3xl items-baseline justify-between px-6 py-6">
      <Link href="/" className="font-semibold">
        Woorim Shin
      </Link>
      <nav className="flex gap-6 text-sm">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="hover:underline">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
