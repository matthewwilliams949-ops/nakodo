import type { Metadata } from 'next'
import { renderLegal } from '../../lib/legal'

export const metadata: Metadata = { title: 'Privacy Policy — Nakodo' }

export default function PrivacyPage() {
  return <main className="legal" dangerouslySetInnerHTML={{ __html: renderLegal('privacy-policy') }} />
}
