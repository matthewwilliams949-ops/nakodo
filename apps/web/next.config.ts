import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // pg is a node-native dependency; keep it external to the server bundle
  serverExternalPackages: ['pg'],
}

export default nextConfig
