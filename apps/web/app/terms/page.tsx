import type { Metadata } from 'next'
import { renderLegal } from '../../lib/legal'

export const metadata: Metadata = { title: 'Terms of Service — Nakodo' }

export default function TermsPage() {
  return <main className="legal" dangerouslySetInnerHTML={{ __html: renderLegal('terms-of-service') }} />
}
