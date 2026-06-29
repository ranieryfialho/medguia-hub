'use client'

import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import type { GerarPdfConferenciaInput } from '@/lib/relatorios/pdf-conferencia-agendamentos'

export function BtnExportarXlsxConferencia({ grupos, periodoLabel, totalGeralSessoes }: GerarPdfConferenciaInput) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const XLSX = await import('xlsx')

      const wb = XLSX.utils.book_new()

      // Planilha de resumo por profissional
      const linhasResumo: Record<string, string | number>[] = grupos.map(g => ({
        'Profissional': g.profissionalNome,
        'Sessões': g.totalSessoes,
        'Total (min)': g.totalMinutos,
        'Total (horas)': g.totalMinutos > 0
          ? `${Math.floor(g.totalMinutos / 60)}h ${g.totalMinutos % 60}min`.trim()
          : '—',
      }))
      linhasResumo.push({
        'Profissional': 'TOTAL GERAL',
        'Sessões': grupos.reduce((a, g) => a + g.totalSessoes, 0),
        'Total (min)': grupos.reduce((a, g) => a + g.totalMinutos, 0),
        'Total (horas)': (() => {
          const t = grupos.reduce((a, g) => a + g.totalMinutos, 0)
          return t > 0 ? `${Math.floor(t / 60)}h ${t % 60}min` : '—'
        })(),
      })

      const wsResumo = XLSX.utils.json_to_sheet(linhasResumo)
      wsResumo['!cols'] = [{ wch: 32 }, { wch: 10 }, { wch: 14 }, { wch: 16 }]
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

      for (const grupo of grupos) {
        const linhas: Record<string, string | number>[] = []

        for (const dia of grupo.dias) {
          for (const sessao of dia.sessoes) {
            linhas.push({
              'Data': dia.dataLabel,
              'Hora': sessao.hora,
              'Paciente': sessao.pacienteNome,
              'Tipo': sessao.tipo,
              'Duração (min)': sessao.duracaoMinutos > 0 ? sessao.duracaoMinutos : '',
              'Sessão': sessao.numeroSessao,
            })
          }
        }

        const ws = XLSX.utils.json_to_sheet(linhas)
        ws['!cols'] = [
          { wch: 24 }, // Data
          { wch: 10 }, // Hora
          { wch: 34 }, // Paciente
          { wch: 24 }, // Tipo
          { wch: 14 }, // Duração
          { wch: 12 }, // Sessão
        ]

        // Excel limita nomes de aba a 31 caracteres e não aceita alguns caracteres
        const nomeAba = grupo.profissionalNome
          .replace(/[:\\\/\?\*\[\]]/g, '')
          .slice(0, 31)

        XLSX.utils.book_append_sheet(wb, ws, nomeAba)
      }

      // Aba de pendentes passados
      const linhasPendentes: Record<string, string>[] = []
      for (const grupo of grupos) {
        for (const p of grupo.pendentesPassados ?? []) {
          linhasPendentes.push({
            'Fisioterapeuta': grupo.profissionalNome,
            'Data': p.dataLabel,
            'Hora': p.hora,
            'Paciente': p.pacienteNome,
            'Tipo': p.tipo,
            'Status': p.status,
          })
        }
      }

      if (linhasPendentes.length > 0) {
        const wsPendentes = XLSX.utils.json_to_sheet(linhasPendentes)
        wsPendentes['!cols'] = [
          { wch: 28 }, // Fisioterapeuta
          { wch: 14 }, // Data
          { wch: 8 },  // Hora
          { wch: 34 }, // Paciente
          { wch: 24 }, // Tipo
          { wch: 16 }, // Status
        ]
        XLSX.utils.book_append_sheet(wb, wsPendentes, 'Pendentes')
      }

      const nomeArquivo = `conferencia-agendamentos-${periodoLabel.toLowerCase().replace(/[\s\/]/g, '-')}.xlsx`
      XLSX.writeFile(wb, nomeArquivo)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || totalGeralSessoes === 0}
      title={totalGeralSessoes === 0 ? 'Nenhum atendimento no período' : 'Exportar Excel'}
      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
    >
      <FileSpreadsheet size={17} />
      {loading ? 'Exportando...' : 'Excel'}
    </button>
  )
}
