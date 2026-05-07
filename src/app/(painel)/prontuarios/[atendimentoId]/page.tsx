import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BtnVoltar } from '@/components/features/shared'
import { ProntuarioFormWrapper } from '@/components/features/prontuarios'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ClipboardList, User } from 'lucide-react'
import { requireModulo } from '@/lib/guard'

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
}

export default async function ProntuarioFormPage({
  params,
}: {
  params: Promise<{ atendimentoId: string }>
}) {
  await requireModulo('prontuarios')

  const { atendimentoId } = await params
  const supabase = await createClient()

  const { data: atendimento } = await supabase
    .from('atendimentos')
    .select(`
      id,
      data_agendamento,
      tipo,
      paciente_id,
      status,
      pacientes(id, nome, convenio, telefone),
      agendamento:agendamentos(tipo, is_recorrente)
    `)
    .eq('id', atendimentoId)
    .single()

  if (!atendimento) notFound()

  const paciente = atendimento.pacientes as unknown as {
    id: string
    nome: string
    convenio?: string | null
    telefone?: string | null
  } | null

  const tipoSessao = (atendimento.agendamento as { tipo?: string } | null)?.tipo
    ?? atendimento.tipo
    ?? 'Sessão'
  const data = new Date(atendimento.data_agendamento)
  const nomeExibido = paciente?.nome ?? 'Paciente'

  return (
    <div className="w-full flex flex-col gap-4 pb-8">

      {/* Top bar — sticky */}
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-100">
        <BtnVoltar href="/prontuarios" />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ClipboardList size={18} className="text-[#006b5a] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#006b5a] leading-tight">Registrar Evolução</h2>
            <p className="text-xs text-slate-500 truncate">{nomeExibido}</p>
          </div>
        </div>
      </div>

      {/* Grid: info | formulário */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 lg:gap-6 items-start">

        {/* Coluna esquerda — sticky no desktop */}
        <div className="lg:sticky lg:top-[68px] space-y-4">

          {/* Card do paciente */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-[#006b5a] flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-md">
                {iniciais(nomeExibido)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-slate-900 text-[15px] leading-tight truncate">
                  {nomeExibido}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 capitalize truncate">
                  {paciente?.convenio || 'Particular'}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <CalendarDays size={15} className="text-[#006b5a] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                    Data da Sessão
                  </p>
                  <p className="text-xs font-semibold text-slate-800 capitalize">
                    {format(data, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {format(data, "HH:mm")}h
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-[#006b5a]/5 rounded-xl border border-[#006b5a]/10">
                <ClipboardList size={15} className="text-[#006b5a] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                    Tipo de Sessão
                  </p>
                  <p className="text-xs font-semibold text-[#006b5a]">{tipoSessao}</p>
                </div>
              </div>

              {paciente?.telefone && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <User size={15} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                      Contato
                    </p>
                    <p className="text-xs text-slate-600">{paciente.telefone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna direita — formulário */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-5 md:p-7">
            <ProntuarioFormWrapper
              atendimentoId={atendimentoId}
              pacienteId={atendimento.paciente_id}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
