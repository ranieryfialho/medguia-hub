import { createClient } from '@supabase/supabase-js'
import { CheckCircle, XCircle, Clock, ShieldCheck, CircleAlert } from 'lucide-react'

function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type Props = { params: Promise<{ token: string }> }

export default async function ConfirmarPage({ params }: Props) {
  const { token } = await params
  const supabase = createSupabaseAdminClient()

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
  const isSucesso = icone === 'ok' || icone === 'ja_confirmado'
  const statusLabel = icone === 'ok'
    ? 'Presença confirmada'
    : icone === 'ja_confirmado'
      ? 'Já confirmado'
      : 'Confirmação indisponível'

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_#dff4ee,_#f8fbfa_45%,_#eef4f2_100%)] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[28px] shadow-[0_24px_70px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">

        {/* Topo colorido */}
        <div className={`p-7 flex flex-col items-center ${isSucesso ? 'bg-[linear-gradient(180deg,#e6f5f1_0%,#f8fcfb_100%)]' : 'bg-[linear-gradient(180deg,#fff1f2_0%,#fff8f8_100%)]'}`}>
          <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-full shadow-sm ${isSucesso ? 'bg-[#006b5a]/10' : 'bg-red-100'}`}>
            {icone === 'ok' && <CheckCircle size={54} className="text-[#006b5a]" />}
            {icone === 'ja_confirmado' && <Clock size={54} className="text-[#006b5a]" />}
            {icone === 'erro' && <XCircle size={54} className="text-red-500" />}
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
            isSucesso ? 'bg-[#006b5a] text-white' : 'bg-red-500 text-white'
          }`}>
            {isSucesso ? <ShieldCheck size={14} /> : <CircleAlert size={14} />}
            {statusLabel}
          </span>
        </div>

        <div className="p-6 space-y-5">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#006b5a]/70">Instituto FOT</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{titulo}</h1>
            <p className="text-sm leading-6 text-slate-500 mt-2">{mensagem}</p>
          </div>

          {atendimento && dataConsulta && (
            <div className="bg-[#006b5a]/5 border border-[#006b5a]/10 rounded-2xl p-4 space-y-2.5">
              <p className="text-xs font-semibold text-[#006b5a] uppercase tracking-wide">Detalhes da consulta</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Paciente:</span> {atendimento.paciente?.nome}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Serviço:</span> {atendimento.tipo}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Data:</span> {dataConsulta}</p>
              {atendimento.profissional && (
                <p className="text-sm text-slate-700"><span className="font-medium">Profissional:</span> {atendimento.profissional.full_name}</p>
              )}
            </div>
          )}

          <div className={`rounded-2xl border px-4 py-3 text-sm ${
            isSucesso
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {isSucesso
              ? 'Seu status foi registrado automaticamente no sistema da clínica.'
              : 'Se necessário, entre em contato com a clínica para confirmar manualmente.'}
          </div>

          <p className="text-center text-xs text-slate-400">Instituto FOT • Fisioterapia e Osteopatia</p>
        </div>
      </div>
    </div>
  )
}
