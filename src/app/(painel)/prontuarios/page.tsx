import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ClipboardList, CheckCheck, ChevronRight, CalendarDays } from 'lucide-react'

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default async function ProntuariosPendentesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? ''
  const isFisio = role !== 'gestor' && role !== 'master'

  const [{ data: comProntuario }, { data: atendimentosRaw }] = await Promise.all([
    supabase.from('prontuarios').select('atendimento_id'),
    (() => {
      const q = supabase
        .from('atendimentos')
        .select(`
          id,
          data_agendamento,
          tipo,
          paciente_id,
          profissional_id,
          pacientes(id, nome),
          agendamento:agendamentos(tipo)
        `)
        .eq('status', 'Concluído')
        .order('data_agendamento', { ascending: false })
        .limit(300)
      return isFisio ? q.eq('profissional_id', user.id) : q
    })(),
  ])

  const idsComProntuario = new Set(comProntuario?.map(p => p.atendimento_id) ?? [])
  const pendentes = (atendimentosRaw ?? []).filter(a => !idsComProntuario.has(a.id))

  return (
    <div className="w-full space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006b5a]/10 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-[#006b5a]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#006b5a]">Prontuários</h2>
            <p className="text-xs text-slate-500">Sessões aguardando registro clínico</p>
          </div>
        </div>
        {pendentes.length > 0 && (
          <span className="bg-red-100 text-red-700 text-sm font-bold px-3 py-1.5 rounded-full shrink-0">
            {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Empty state */}
      {pendentes.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <CheckCheck size={32} className="text-[#006b5a]" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-lg">Tudo em dia!</p>
            <p className="text-slate-500 text-sm mt-1">
              Nenhuma sessão aguardando registro de evolução.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pendentes.map(atendimento => {
            const paciente = atendimento.pacientes as unknown as { id: string; nome: string } | null
            const tipo = (atendimento.agendamento as { tipo?: string } | null)?.tipo
              ?? atendimento.tipo
              ?? 'Sessão'
            const nome = paciente?.nome ?? 'Paciente'
            const data = new Date(atendimento.data_agendamento)

            return (
              <Link
                key={atendimento.id}
                href={`/prontuarios/${atendimento.id}`}
                className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-[#006b5a]/30 hover:shadow-md active:scale-[0.99] transition-all group"
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-2xl bg-[#006b5a] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                  {iniciais(nome)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate leading-tight">{nome}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <CalendarDays size={11} />
                      {format(data, "dd MMM yyyy · HH:mm", { locale: ptBR })}
                    </span>
                    <span className="text-[11px] font-semibold text-[#006b5a] bg-[#006b5a]/10 px-2 py-0.5 rounded-full">
                      {tipo}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="hidden sm:block text-xs font-semibold text-[#006b5a]">
                    Preencher
                  </span>
                  <ChevronRight
                    size={18}
                    className="text-slate-300 group-hover:text-[#006b5a] group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}