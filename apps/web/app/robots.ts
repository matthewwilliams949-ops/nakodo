import type { MetadataRoute } from 'next'

// Token-bearing surfaces must never be crawled or indexed. /intro/[token] is a
// capability URL — the 256-bit token is the only gate — so we keep it out of
// search engines entirely (defense-in-depth; the HTTP X-Robots-Tag header in
// next.config.ts is the enforcing layer, this is the polite one). The marketing
// root stays indexable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/intro/', '/api/'],
    },
    host: 'https://nakodo.dev',
  }
}
