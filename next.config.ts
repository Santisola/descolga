import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite ships a .wasm payload that must not go through the bundler. It's only
  // used by the development database fallback.
  serverExternalPackages: ['@electric-sql/pglite'],
  async headers() {
    return [
      {
        // The service worker must be served from the origin root with no
        // caching, otherwise a stale copy keeps handling `push` events.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ]
  },
}

export default nextConfig
