import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './nocturne.css'
import './app.css'

// Self-hosted through next/font so the PWA renders correctly with no network.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Descolgá',
  description: 'Anotá en dos segundos y que el aviso insista hasta que lo marqués hecho.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Descolgá',
  appleWebApp: {
    capable: true,
    title: 'Descolgá',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#161826',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // The app is a single scrolling column; pinch-zoom on it only fights the user.
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
