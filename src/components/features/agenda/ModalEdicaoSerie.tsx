'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { buscarSessoesRecorrencia, editarSessoesDaSerie } from '@/actions/agenda'
import { getAtendimentoStatusKey } from '@/lib/atendimento-status'
import { formatAppDateKey, formatAppTime } from '@/lib/datetime'

type SessaoRaw = {
  id: string
  data_agendamento: string
  numero_sessao: number | null
  total_sessoes: number | null
  profissional_id: string | null
  duracao_minutos: number | null
  status: string
}

type SessaoEditavel = {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  profissional_id: string
  numero_sessao: number | null
  total_sessoes: number | null
  concluido: boolean
}

type ModalEdicaoSerieProps = {
  agendamentoPaiId: string
  profissionais: { id: string; full_name: string }[]
  onClose: () => void
  onSalvo: () => void
  standalone?: boolean
}

function parseSessao(s: SessaoRaw): SessaoEditavel {
  const dt = new Date(s.data_agendamento)
  const data = formatAppDateKey(dt)
  const hora_inicio = formatAppTime(dt)
  const fimDt = new Date(dt.getTime() + (s.duracao_minutos ?? 60) * 60000)
  const hora_fim = formatAppTime(fimDt)

  return {
    id: s.id,
    data,
    hora_inicio,
    hora_fim,
    profissional_id: s.profissional_id ?? '',
    numero_sessao: s.numero_sessao,
    total_sessoes: s.total_sessoes,
    concluido: getAtendimentoStatusKey(s.status) === 'concluido',
  }
}

export function ModalEdicaoSerie({ agendamentoPaiId, profissionais, onClose, onSalvo, standalone = false }: ModalEdicaoSerieProps) {
  const router = useRouter()
  const [sessoes, setSessoes] = useState<SessaoEditavel[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    buscarSessoesRecorrencia(agendamentoPaiId).then((result) => {
      setLoading(false)
      if ('error' in result) {
        toast.error(result.error ?? 'Erro ao buscar sessões.')
        onClose()
        return
      }
      setSessoes(result.data.map(parseSessao))
    })
  }, [agendamentoPaiId, onClose])

  function atualizarSessao(id: string, campo: Partial<SessaoEditavel>) {
    setSessoes(prev => prev.map(s => s.id === id ? { ...s, ...campo } : s))
  }

  async function handleSalvar() {
    const editaveis = sessoes.filter(s => !s.concluido)
    if (editaveis.length === 0) return

    setSalvando(true)
    const resultado = await editarSessoesDaSerie(
      editaveis.map(({ id, data, hora_inicio, hora_fim, profissional_id }) => ({
        id, data, hora_inicio, hora_fim, profissional_id,
      }))
    )
    setSalvando(false)

    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    toast.success('Sessões atualizadas!')
    router.refresh()
    onSalvo()
  }

  const totalEditaveis = sessoes.filter(s => !s.concluido).length

  const inner = (
    <div className={standalone
      ? 'relative w-full max-w-lg flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden'
      : 'absolute inset-0 z-20 flex flex-col rounded-2xl bg-white overflow-hidden'}
      style={standalone ? { maxHeight: 'calc(100svh - 80px)' } : undefined}
    >
      <div
        className="border-b border-[#bcc9c4]/30 px-5 pb-4"
        style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}
      >
        <h4 className="font-bold text-[#083142]">Editar série</h4>
        <p className="mt-0.5 text-xs text-[#6d7a75]">
          {loading ? 'Carregando...' : `${sessoes.length} sessão(ões) · ${totalEditaveis} editável(eis)`}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-[#6d7a75]">
          Carregando sessões...
        </div>
      ) : sessoes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-slate-400">Nenhuma sessão encontrada.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {sessoes.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border px-3 py-2.5 space-y-2 ${
                s.concluido
                  ? 'border-[#bcc9c4]/20 bg-slate-50 opacity-50'
                  : 'border-[#bcc9c4]/40 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#006b5a]">
                  Sessão {s.numero_sessao ?? '—'}{s.total_sessoes ? ` de ${s.total_sessoes}` : ''}
                </span>
                {s.concluido && (
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    Concluída
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input
                  type="date"
                  value={s.data}
                  disabled={s.concluido}
                  onChange={e => atualizarSessao(s.id, { data: e.target.value })}
                  className="col-span-2 sm:col-span-1 rounded-lg border border-[#bcc9c4] px-2 py-1.5 text-sm text-[#171d1c] focus:outline-none focus:border-[#006b5a] disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
                <input
                  type="time"
                  value={s.hora_inicio}
                  disabled={s.concluido}
                  onChange={e => atualizarSessao(s.id, { hora_inicio: e.target.value })}
                  className="rounded-lg border border-[#bcc9c4] px-2 py-1.5 text-sm text-[#171d1c] focus:outline-none focus:border-[#006b5a] disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
                <input
                  type="time"
                  value={s.hora_fim}
                  disabled={s.concluido}
                  onChange={e => atualizarSessao(s.id, { hora_fim: e.target.value })}
                  className="rounded-lg border border-[#bcc9c4] px-2 py-1.5 text-sm text-[#171d1c] focus:outline-none focus:border-[#006b5a] disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
              </div>

              {profissionais.length > 0 && (
                <select
                  value={s.profissional_id}
                  disabled={s.concluido}
                  onChange={e => atualizarSessao(s.id, { profissional_id: e.target.value })}
                  className="w-full rounded-lg border border-[#bcc9c4] px-2 py-1.5 text-sm text-[#171d1c] focus:outline-none focus:border-[#006b5a] disabled:bg-slate-50 disabled:cursor-not-allowed"
                >
                  <option value="">Sem profissional</option>
                  {profissionais.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className="border-t border-[#bcc9c4]/30 px-4 pt-3 pb-5 space-y-2"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={handleSalvar}
          disabled={salvando || loading || totalEditaveis === 0}
          className="w-full rounded-xl bg-[#006b5a] py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
        >
          {salvando ? 'Salvando...' : `Salvar ${totalEditaveis} sessão(ões)`}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-sm text-[#6d7a75] hover:text-[#3d4945] transition-colors"
        >
          Voltar
        </button>
      </div>
    </div>
  )

  if (standalone) {
    return (
      <div className="fixed inset-0 z-[70] overflow-y-auto">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <div className="relative flex min-h-full items-center justify-center px-4 py-10">
          {inner}
        </div>
      </div>
    )
  }

  return inner
}
