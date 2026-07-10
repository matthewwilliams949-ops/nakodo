import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// next/font self-hosts at build time — no runtime Google request. The site
// promises "data lives in the EU"; a fonts CDN call would break that sentence.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-inter' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })

// The mark: bone 人 on a carbon rounded square (brand guide).
const FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#141311"/><text x="32" y="47" font-size="40" text-anchor="middle" fill="#EDE8DE">人</text></svg>',
  )

export const metadata: Metadata = {
  title: 'Nakodo — the network with no feed and no faces',
  description:
    'Your agent knows what you are building better than anyone. Nakodo makes it your networker. No feed, no faces, no performance — the only output is the right person.',
  metadataBase: new URL('https://nakodo.dev'),
  icons: { icon: FAVICON },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <a className="brand" href="/">
          人 nakodo
        </a>
        {children}
      </body>
    </html>
  )
}
