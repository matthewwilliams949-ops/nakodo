import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'

// Legal pages render from the source markdown in apps/web/content/legal so the
// wording stays a single source of truth (also the repo copy in
// documentation/legal). Read + rendered at BUILD time (the routes are static),
// so the .md is never a runtime dependency. Content is our own — the marked
// output is trusted, not user input.
export type LegalSlug = 'privacy-policy' | 'terms-of-service' | 'impressum'

export function renderLegal(slug: LegalSlug): string {
  const md = readFileSync(join(process.cwd(), 'content', 'legal', `${slug}.md`), 'utf8')
  return marked.parse(md, { async: false })
}
