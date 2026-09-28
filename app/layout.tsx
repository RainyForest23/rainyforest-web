import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SiteHeader } from '@/components/site/site-header'
import '@fontsource/ibm-plex-sans/300.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-sans-kr/300.css'
import '@fontsource/ibm-plex-sans-kr/400.css'
import '@fontsource/ibm-plex-sans-kr/500.css'
import 'katex/dist/katex.min.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Woorim Shin',
  description: 'Engineer and researcher working on on-device AI systems.',
  other: { 'build-sha': process.env.BUILD_SHA ?? 'dev' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* bp6-dark puts every Blueprint component on its dark theme. */}
      <body className="bp6-dark">
        <SiteHeader />
        <main className="page-wrap">
          {children}
          <footer className="site-footer">
            <span>© Woorim Shin</span>
            <a href="/feed.xml">RSS</a>
          </footer>
        </main>
      </body>
    </html>
  )
}
