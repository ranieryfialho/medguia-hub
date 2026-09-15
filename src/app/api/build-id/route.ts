import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Expõe o BUILD_ID do processo em execução (setado no Dockerfile a partir do
 * SHA do commit deployado). O client compara esse valor com o que veio
 * embutido no seu próprio bundle para detectar que o servidor já subiu uma
 * build nova — ver StaleServerActionWatcher.
 */
export async function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
