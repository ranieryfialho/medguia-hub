import type { Metadata } from 'next'
import './globals.css'
import { PageTransitionLoader } from '@/components/layout/PageTransitionLoader'

export const metadata: Metadata = {
  title: 'MedGuia Hub',
  description: 'Gestão inteligente para sua clínica',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <PageTransitionLoader />
        {children}
      </body>
    </html>
  )
}
