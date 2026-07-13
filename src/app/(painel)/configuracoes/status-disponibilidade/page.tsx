import { requireModulo } from '@/lib/guard'
import { listarStatusOpcoes } from '@/actions/status-disponibilidade-config'
import { GerenciadorStatusDisponibilidade } from '@/components/features/configuracoes'
import { CircleDot } from 'lucide-react'

export default async function StatusDisponibilidadePage() {
  await requireModulo('configuracoes:status_disponibilidade')
  const opcoes = await listarStatusOpcoes()

  return (
    <div className="w-full space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <CircleDot size={24} className="text-[#006b5a]" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">Status de Disponibilidade</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure os status que os profissionais podem definir no dia a dia
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <GerenciadorStatusDisponibilidade opcoes={opcoes} />
      </div>
    </div>
  )
}