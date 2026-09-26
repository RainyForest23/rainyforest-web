import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SiteHeader } from '@/components/site/site-header'
import './globals.css'

export const metadata: Metadata = {
  title: 'Woorim Shin',
  description: 'Engineer and researcher working on on-device AI systems.',
  other: { 'build-sha': process.env.BUILD_SHA ?? 'dev' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  )
}
