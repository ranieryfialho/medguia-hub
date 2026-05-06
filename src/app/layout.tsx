import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PageTransitionLoader } from '@/components/layout/PageTransitionLoader'

export const metadata: Metadata = {
  title: 'MedGuia Hub',
  description: 'Gestão inteligente para sua clínica',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <PageTransitionLoader />
        {children}
      </body>
    </html>
  )
}
