import { createClient } from '@/lib/supabase/server'
import { Target, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { criarContagemStatusContato, LABEL_POR_STATUS_CONTATO } from '@/lib/contatos-kanban'

type Contato = {
  status: string
  responsavel_id: string | null
}

export default async function FunilContatos({
  userId,
  isGestorOuMaster,
}: {
  userId: string
  isGestorOuMaster: boolean
}) {
  const supabase = await createClient()

  const { data } = isGestorOuMaster
    ? await supabase.from('contatos_base').select('status, responsavel_id')
    : await supabase.from('contatos_base').select('status, responsavel_id').eq('responsavel_id', userId)

  const contatos: Contato[] = data || []

  const contagemPorStatus = criarContagemStatusContato()
  for (const contato of contatos) {
    if (contato.status in contagemPorStatus) {
      contagemPorStatus[contato.status as keyof typeof contagemPorStatus]++
    }
  }
  const totalContatos = contatos.length
  const semResponsavel = contatos.filter(c => !c.responsavel_id).length

  if (!isGestorOuMaster || totalContatos === 0) return null

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#f0fcf9] p-2.5 rounded-lg">
            <Target size={18} className="text-[#006b5a]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest">Funil de Contatos</h3>
            <p className="text-xs text-[#3d4945]/60 mt-0.5">{totalContatos} contatos em base</p>
          </div>
        </div>
        <Link
          href="/contatos/relatorio"
          className="flex items-center gap-2 px-4 py-2 bg-[#f0fcf9] hover:bg-[#e0f9f5] text-[#006b5a] rounded-lg text-xs font-semibold transition-colors"
        >
          Ver relatório
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: LABEL_POR_STATUS_CONTATO.a_contactar, value: contagemPorStatus.a_contactar, cor: 'bg-gray-100 text-gray-700' },
          { label: LABEL_POR_STATUS_CONTATO.recuperacao_base, value: contagemPorStatus.recuperacao_base, cor: 'bg-indigo-100 text-indigo-700' },
          { label: LABEL_POR_STATUS_CONTATO.tentativa, value: contagemPorStatus.tentativa, cor: 'bg-amber-100 text-amber-700' },
          { label: LABEL_POR_STATUS_CONTATO.em_conversa, value: contagemPorStatus.em_conversa, cor: 'bg-teal-100 text-teal-700' },
          { label: LABEL_POR_STATUS_CONTATO.sem_interesse, value: contagemPorStatus.sem_interesse, cor: 'bg-red-100 text-red-700' },
          { label: LABEL_POR_STATUS_CONTATO.agendou, value: contagemPorStatus.agendou, cor: 'bg-green-100 text-green-700' },
        ].map((item) => (
          <div key={item.label} className={`p-3 rounded-lg ${item.cor} text-center`}>
            <p className="text-lg font-bold">{item.value}</p>
            <p className="text-xs font-medium mt-1 opacity-80">{item.label}</p>
          </div>
        ))}
      </div>

      {semResponsavel > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-lg">
          <p className="text-sm font-semibold text-orange-700">
            ⚠️ {semResponsavel} contato(s) sem responsável atribuído
          </p>
        </div>
      )}
    </div>
  )
}
