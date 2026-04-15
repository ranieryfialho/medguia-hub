import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
