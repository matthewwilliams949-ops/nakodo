import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

// PLACEHOLDER name + copy skeleton — rename pass (BUILD-PLAN M1) makes this real.
export const metadata: Metadata = {
  title: 'Agent Networker — the network with no feed and no faces',
  description:
    'Your agent knows what you are building better than anyone. We make it your networker. No feed, no faces, no performance — the only output is the right person.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
