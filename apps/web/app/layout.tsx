import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nakodo — the network with no feed and no faces',
  description:
    'Your agent knows what you are building better than anyone. Nakodo makes it your networker. No feed, no faces, no performance — the only output is the right person.',
  metadataBase: new URL('https://nakodo.dev'),
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
