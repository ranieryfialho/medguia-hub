import { createClient } from '@/lib/supabase/server'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

type Props = { params: Promise<{ token: string }> }

export default async function ConfirmarPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('atendimentos')
    .select('id, status, contato_confirmacao, data_agendamento, tipo, paciente:pacientes(nome), profissional:profiles!profissional_id(full_name)')
    .eq('token_confirmacao', token)
    .single()

  // Normaliza os joins (Supabase pode retornar arrays para tabelas relacionadas)
  const atendimento = raw ? {
    ...raw,
    paciente: (Array.isArray(raw.paciente) ? raw.paciente[0] : raw.paciente) as { nome: string } | null,
    profissional: (Array.isArray(raw.profissional) ? raw.profissional[0] : raw.profissional) as { full_name: string } | null,
  } : null

  if (!atendimento) {
    return <Tela icone="erro" titulo="Link inválido" mensagem="Este link de confirmação não existe ou expirou." />
  }

  if (atendimento.status === 'Confirmado' || atendimento.contato_confirmacao === 'confirmou') {
    return <Tela icone="ja_confirmado" titulo="Consulta já confirmada!" mensagem="Sua presença já estava registrada. Até logo!" atendimento={atendimento} />
  }

  if (atendimento.status !== 'Aguardando') {
    return <Tela icone="erro" titulo="Consulta indisponível" mensagem="Esta consulta não pode ser confirmada pelo link." />
  }

  const { error } = await supabase
    .from('atendimentos')
    .update({ status: 'Confirmado', contato_confirmacao: 'confirmou' })
    .eq('id', atendimento.id)

  if (error) {
    return <Tela icone="erro" titulo="Erro ao confirmar" mensagem="Não foi possível confirmar sua consulta. Entre em contato com a clínica." />
  }

  return <Tela icone="ok" titulo="Consulta confirmada!" mensagem="Obrigado! Sua presença foi registrada. Até logo!" atendimento={atendimento} />
}

type Icone = 'ok' | 'ja_confirmado' | 'erro'

function Tela({ icone, titulo, mensagem, atendimento }: {
  icone: Icone
  titulo: string
  mensagem: string
  atendimento?: {
    data_agendamento: string
    tipo: string
    paciente: { nome: string } | null
    profissional: { full_name: string } | null
  } | null
}) {
  const dataConsulta = atendimento
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(atendimento.data_agendamento))
    : null

  return (
    <div className="min-h-dvh bg-[#f9fafb] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">

        {/* Topo colorido */}
        <div className={`p-6 flex flex-col items-center ${icone === 'ok' || icone === 'ja_confirmado' ? 'bg-[#006b5a]/10' : 'bg-red-50'}`}>
          {icone === 'ok' && <CheckCircle size={56} className="text-[#006b5a]" />}
          {icone === 'ja_confirmado' && <Clock size={56} className="text-[#006b5a]" />}
          {icone === 'erro' && <XCircle size={56} className="text-red-500" />}
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">{titulo}</h1>
            <p className="text-sm text-slate-500 mt-1">{mensagem}</p>
          </div>

          {atendimento && dataConsulta && (
            <div className="bg-[#006b5a]/5 border border-[#006b5a]/10 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-[#006b5a] uppercase tracking-wide">Detalhes da consulta</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Paciente:</span> {atendimento.paciente?.nome}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Serviço:</span> {atendimento.tipo}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Data:</span> {dataConsulta}</p>
              {atendimento.profissional && (
                <p className="text-sm text-slate-700"><span className="font-medium">Profissional:</span> {atendimento.profissional.full_name}</p>
              )}
            </div>
          )}

          <p className="text-center text-xs text-slate-400">Instituto FOT • Fisioterapia e Osteopatia</p>
        </div>
      </div>
    </div>
  )
}
