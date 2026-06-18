import { requireModulo } from '@/lib/guard'
import { buscarAuditoriaGeral } from '@/actions/confirmacoes-auditoria'
import { HistoricoConfirmacoesClient } from './HistoricoConfirmacoesClient'

export default async function HistoricoConfirmacoesPage() {
  await requireModulo('confirmacoes:cards')

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const fimHoje = new Date()
  fimHoje.setHours(23, 59, 59, 999)

  const eventos = await buscarAuditoriaGeral({
    data_inicio: new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    data_fim: fimHoje.toISOString(),
  })

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#006b5a]">Histórico de Confirmações</h2>
          <p className="text-xs text-slate-500 mt-0.5">Ações dos últimos 7 dias — envios e alterações de status</p>
        </div>
      </div>
      <HistoricoConfirmacoesClient eventosIniciais={eventos} />
    </div>
  )
}