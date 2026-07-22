'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import type { GerarMarkdownFollowUpsInput } from '@/lib/relatorios/markdown-follow-ups'
import { baixarMarkdownFollowUps } from '@/lib/relatorios/markdown-follow-ups'

export function BtnExportarMdFollowUps(props: GerarMarkdownFollowUpsInput) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    try {
      setLoading(true)
      baixarMarkdownFollowUps(props)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Exportar em Markdown para criar apresentação (ex: Gamma)"
      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#bcc9c4]/50 text-[#171d1c] rounded-xl font-bold hover:bg-[#f0f5f4] transition-colors disabled:opacity-60"
    >
      <FileText size={18} />
      {loading ? 'Exportando...' : 'Extrair para Apresentação'}
    </button>
  )
}
