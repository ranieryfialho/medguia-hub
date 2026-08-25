'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { buscarLogsExclusaoPaciente, type LogExclusaoPaciente } from '@/actions/pacientes'

const ACAO_LABEL: Record<string, string> = {
  exclusao_avulso: 'Agendamento avulso',
  exclusao_sessao_recorrente: 'Sessão pontual (recorrência)',
  exclusao_serie_completa: 'Série completa',
  exclusao_lote: 'Lote de atendimentos',
}

function formatarDataHora(valor: string | null): string {
  if (!valor) return '—'
  try {
    return format(new Date(valor), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return valor
  }
}

export function TabLogsPaciente({ pacienteId }: { pacienteId: string }) {
  const [logs, setLogs] = useState<LogExclusaoPaciente[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    buscarLogsExclusaoPaciente(pacienteId).then((data) => {
      setLogs(data)
      setCarregando(false)
    })
  }, [pacienteId])

  if (carregando) return (
    <div className="flex items-center justify-center py-16 text-sm text-[#6d7a75]">
      <Loader2 size={20} className="animate-spin mr-2" />Carregando...
    </div>
  )

  if (logs.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <Trash2 size={32} className="text-slate-200" />
      <p className="text-sm font-semibold text-[#3d4945]">Nenhuma exclusão registrada para este paciente</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] text-[#6d7a75]">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#006b5a]" />
        <p>Estes registros são gravados automaticamente e são imutáveis: nenhum usuário, inclusive administradores, pode editá-los ou apagá-los.</p>
      </div>

      <div className="space-y-3">
        {logs.map((log) => {
          const dados = log.dados_agendamento
          const sessaoInfo = dados.numero_sessao && dados.total_sessoes
            ? ` — Sessão ${dados.numero_sessao}/${dados.total_sessoes}`
            : ''
          return (
            <div key={log.id} className="rounded-xl border border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#083142]">
                  {ACAO_LABEL[log.acao] ?? log.acao}
                </p>
                <p className="text-[10px] text-[#6d7a75]">{formatarDataHora(log.criado_em)}</p>
              </div>

              <p className="mt-1 text-[11px] text-[#6d7a75]">
                Excluído por <span className="font-semibold text-[#3d4945]">{log.usuario_nome ?? 'Usuário desconhecido'}</span>
              </p>

              <p className="mt-1 text-[11px] text-[#6d7a75]">
                Motivo: <span className="font-semibold text-[#3d4945]">{log.motivo_categoria_label}</span>
                {log.motivo_observacao ? ` — ${log.motivo_observacao}` : ''}
              </p>

              <p className="mt-1 text-[11px] text-[#6d7a75]">
                Sessão apagada: {dados.tipo ?? 'Sessão'}{sessaoInfo}, {formatarDataHora(dados.data_agendamento)}, status {dados.status ?? '—'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
