import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // pg is a node-native dependency; keep it external to the server bundle
  serverExternalPackages: ['pg'],

  // The intro/thread surface is gated only by an unguessable 256-bit token in
  // the path (a capability URL). Two hardening headers on it:
  //   * X-Robots-Tag: keep leaked links out of search indexes entirely — the
  //     enforcing layer behind app/robots.ts.
  //   * Referrer-Policy: no-referrer so the token never rides a Referer header
  //     off-site (the page has no external links today, but this pins it).
  async headers() {
    return [
      {
        source: '/intro/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ]
  },
}

export default nextConfig
