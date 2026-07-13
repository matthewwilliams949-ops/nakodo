import type { Metadata } from 'next'
import { renderLegal } from '../../lib/legal'

export const metadata: Metadata = { title: 'Impressum — Nakodo' }

export default function ImpressumPage() {
  return <main className="legal" dangerouslySetInnerHTML={{ __html: renderLegal('impressum') }} />
}
