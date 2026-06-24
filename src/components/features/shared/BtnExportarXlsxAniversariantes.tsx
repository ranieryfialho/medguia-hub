'use client'

import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'

export interface ExportarXlsxAniversariantesInput {
  periodoLabel: string
  pacientes: Array<{
    nome: string
    diaMes: string
    idade: number
    diaSemana: string
    telefone: string
    email: string
    convenio: string
    isHoje: boolean
    isProximos7: boolean
  }>
}

export function BtnExportarXlsxAniversariantes({ periodoLabel, pacientes }: ExportarXlsxAniversariantesInput) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const XLSX = await import('xlsx')

      const linhas = pacientes.map(p => ({
        'Nome': p.nome,
        'Aniversário': p.diaMes,
        'Completa': `${p.idade} anos`,
        'Dia da semana': p.diaSemana,
        'Telefone': p.telefone || '—',
        'Email': p.email || '—',
        'Convênio': p.convenio || '—',
        'Status': p.isHoje ? 'Hoje' : p.isProximos7 ? 'Próximos 7 dias' : '—',
      }))

      const ws = XLSX.utils.json_to_sheet(linhas)

      // Largura das colunas
      ws['!cols'] = [
        { wch: 36 }, // Nome
        { wch: 12 }, // Aniversário
        { wch: 14 }, // Completa
        { wch: 18 }, // Dia da semana
        { wch: 18 }, // Telefone
        { wch: 30 }, // Email
        { wch: 22 }, // Convênio
        { wch: 16 }, // Status
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Aniversariantes')

      const nomeArquivo = `aniversariantes-${periodoLabel.toLowerCase().replace(/\s+/g, '-')}.xlsx`
      XLSX.writeFile(wb, nomeArquivo)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || pacientes.length === 0}
      title={pacientes.length === 0 ? 'Nenhum aniversariante para exportar' : 'Exportar para Excel'}
      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
    >
      <FileSpreadsheet size={17} />
      {loading ? 'Exportando...' : 'Excel'}
    </button>
  )
}