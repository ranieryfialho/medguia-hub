'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { buscarAtendimentosPendentesRecorrencia, deletarAtendimentosSelecionados } from '@/actions/agenda'
import { formatAppDateLabel, formatAppTime } from '@/lib/datetime'

type Pendente = {
  id: string
  data_agendamento: string
  numero_sessao: number | null
  total_sessoes: number | null
  status: string
}

type ModalSelecaoExclusaoProps = {
  agendamentoPaiId: string
  onClose: () => void
  onExcluido: () => void
}

export function ModalSelecaoExclusao({ agendamentoPaiId, onClose, onExcluido }: ModalSelecaoExclusaoProps) {
  const router = useRouter()
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [loadingPendentes, setLoadingPendentes] = useState(true)
  const [excluindoSelecionados, setExcluindoSelecionados] = useState(false)

  useEffect(() => {
    buscarAtendimentosPendentesRecorrencia(agendamentoPaiId).then((result) => {
      setLoadingPendentes(false)
      if ('error' in result) {
        toast.error(result.error ?? 'Erro ao buscar atendimentos.')
        onClose()
        return
      }
      setPendentes(result.data)
      setSelecionados(new Set(result.data.map((a) => a.id)))
    })
  }, [agendamentoPaiId, onClose])

  async function handleExcluirSelecionados() {
    if (selecionados.size === 0) return
    setExcluindoSelecionados(true)
    const resultado = await deletarAtendimentosSelecionados(Array.from(selecionados), agendamentoPaiId)
    setExcluindoSelecionados(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    router.refresh()
    onExcluido()
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col rounded-2xl bg-white overflow-hidden">
      <div
        className="border-b border-[#bcc9c4]/30 px-5 pb-4"
        style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}
      >
        <h4 className="font-bold text-[#083142]">Selecionar para excluir</h4>
        <p className="mt-0.5 text-xs text-[#6d7a75]">Apenas atendimentos não concluídos são exibidos</p>
      </div>

      {loadingPendentes ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-[#6d7a75]">
          Carregando atendimentos...
        </div>
      ) : pendentes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-slate-400">Nenhum atendimento pendente nesta recorrência</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-5 py-2 border-b border-[#bcc9c4]/20">
            <span className="text-xs text-[#6d7a75]">{selecionados.size} de {pendentes.length} selecionados</span>
            <button
              type="button"
              onClick={() => setSelecionados(
                selecionados.size === pendentes.length
                  ? new Set()
                  : new Set(pendentes.map((a) => a.id))
              )}
              className="text-xs font-semibold text-[#006b5a]"
            >
              {selecionados.size === pendentes.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {pendentes.map((a) => {
              const dataAppt = new Date(a.data_agendamento)
              const isSel = selecionados.has(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelecionados((prev) => {
                    const next = new Set(prev)
                    if (next.has(a.id)) next.delete(a.id)
                    else next.add(a.id)
                    return next
                  })}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isSel ? 'bg-red-50' : 'hover:bg-[#f0f5f4]'
                  }`}
                >
                  <div className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    isSel ? 'border-[#ba1a1a] bg-[#ba1a1a]' : 'border-[#bcc9c4]'
                  }`}>
                    {isSel && <Check size={12} className="text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#171d1c]">
                      {formatAppDateLabel(dataAppt)} · {formatAppTime(dataAppt)}
                    </p>
                    {a.numero_sessao != null && (
                      <p className="text-xs text-[#6d7a75]">
                        Sessão {a.numero_sessao}{a.total_sessoes != null ? ` de ${a.total_sessoes}` : ''}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      <div
        className="border-t border-[#bcc9c4]/30 px-4 pt-3 pb-5 space-y-2"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={handleExcluirSelecionados}
          disabled={selecionados.size === 0 || excluindoSelecionados}
          className="w-full rounded-xl bg-[#ba1a1a] py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
        >
          {excluindoSelecionados
            ? 'Excluindo...'
            : `Excluir ${selecionados.size} atendimento${selecionados.size !== 1 ? 's' : ''}`}
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
}
