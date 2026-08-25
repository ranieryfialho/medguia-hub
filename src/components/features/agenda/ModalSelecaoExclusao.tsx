'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { buscarAtendimentosPendentesRecorrencia, deletarAtendimentosSelecionados, type MotivoExclusao } from '@/actions/agenda'
import { createClient } from '@/lib/supabase/client'
import { formatAppDateLabel, formatAppTime } from '@/lib/datetime'

type Pendente = {
  id: string
  data_agendamento: string
  numero_sessao: number | null
  total_sessoes: number | null
  status: string
}

// Mesmo catálogo/padrão de motivo do AgendamentoModal (T-038): lido direto de
// motivos_exclusao_agendamento (RLS libera SELECT para authenticated, T-034).
// A validação de fato acontece de novo no servidor por fn_excluir_atendimentos
// (AC-045, AC-057) — aqui é só o que bloqueia o botão de confirmar.
type MotivoCatalogoItem = { slug: string; label: string; exige_observacao: boolean }

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
  const [passoMotivo, setPassoMotivo] = useState(false)
  const [motivosCatalogo, setMotivosCatalogo] = useState<MotivoCatalogoItem[] | null>(null)
  const [carregandoMotivos, setCarregandoMotivos] = useState(false)
  const [motivoCategoria, setMotivoCategoria] = useState<string | null>(null)
  const [motivoObservacao, setMotivoObservacao] = useState('')

  const categoriaSelecionada = motivosCatalogo?.find((m) => m.slug === motivoCategoria) ?? null
  // AC-044: sem categoria, botão fica desabilitado. AC-045: "Outros" (exige_observacao)
  // também exige texto não-vazio (trim cobre "só espaços").
  const motivoValido = !!motivoCategoria && (!categoriaSelecionada?.exige_observacao || motivoObservacao.trim().length > 0)

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

  async function carregarMotivosCatalogo() {
    if (motivosCatalogo || carregandoMotivos) return
    setCarregandoMotivos(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('motivos_exclusao_agendamento')
      .select('slug, label, exige_observacao')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
    setCarregandoMotivos(false)
    if (error) {
      toast.error('Não foi possível carregar os motivos de exclusão.')
      setMotivosCatalogo([])
      return
    }
    setMotivosCatalogo(data ?? [])
  }

  function abrirPassoMotivo() {
    if (selecionados.size === 0) return
    setPassoMotivo(true)
    setMotivoCategoria(null)
    setMotivoObservacao('')
    void carregarMotivosCatalogo()
  }

  function cancelarPassoMotivo() {
    setPassoMotivo(false)
    setMotivoCategoria(null)
    setMotivoObservacao('')
  }

  async function handleExcluirSelecionados() {
    if (selecionados.size === 0 || !motivoValido || !motivoCategoria) return

    const motivo: MotivoExclusao = {
      categoria: motivoCategoria,
      observacao: motivoObservacao.trim() ? motivoObservacao.trim() : undefined,
    }

    setExcluindoSelecionados(true)
    const resultado = await deletarAtendimentosSelecionados(Array.from(selecionados), agendamentoPaiId, motivo)
    setExcluindoSelecionados(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    router.refresh()
    onExcluido()
  }

  if (passoMotivo) {
    return (
      <div className="absolute inset-0 z-20 flex flex-col rounded-2xl bg-white overflow-hidden">
        <div
          className="flex items-center justify-between border-b border-[#bcc9c4]/30 px-5 pb-4"
          style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}
        >
          <h4 className="font-bold text-[#083142]">Motivo da exclusão</h4>
          <button
            type="button"
            onClick={cancelarPassoMotivo}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Cancelar exclusão"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <p className="rounded-lg bg-[#fbeaea] px-3 py-2 text-xs font-semibold text-[#ba1a1a]">
            Isso vai excluir {selecionados.size} atendimento{selecionados.size !== 1 ? 's' : ''} deste lote.
            Se algum estiver concluído, a exclusão inteira é recusada — nenhum atendimento do lote é removido.
          </p>

          {carregandoMotivos ? (
            <p className="text-xs text-slate-400">Carregando motivos...</p>
          ) : (
            <div className="space-y-1">
              {(motivosCatalogo ?? []).map((m) => (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => setMotivoCategoria(m.slug)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                    motivoCategoria === m.slug
                      ? 'bg-[#006b5a]/10 text-[#006b5a]'
                      : 'text-[#3d4945] hover:bg-[#f0f5f4]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {categoriaSelecionada?.exige_observacao && (
            <textarea
              value={motivoObservacao}
              onChange={(e) => setMotivoObservacao(e.target.value)}
              placeholder="Descreva o motivo..."
              rows={3}
              className="w-full rounded-lg border border-[#bcc9c4] px-3 py-2 text-xs text-[#3d4945] focus:outline-none focus:ring-1 focus:ring-[#006b5a]"
            />
          )}
        </div>

        <div
          className="border-t border-[#bcc9c4]/30 px-4 pt-3 pb-5 space-y-2"
          style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={() => void handleExcluirSelecionados()}
            disabled={!motivoValido || excluindoSelecionados}
            className="w-full rounded-xl bg-[#ba1a1a] py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
          >
            {excluindoSelecionados
              ? 'Excluindo...'
              : `Confirmar exclusão de ${selecionados.size} atendimento${selecionados.size !== 1 ? 's' : ''}`}
          </button>
          <button
            type="button"
            onClick={cancelarPassoMotivo}
            className="w-full py-2 text-sm text-[#6d7a75] hover:text-[#3d4945] transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    )
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
          onClick={abrirPassoMotivo}
          disabled={selecionados.size === 0}
          className="w-full rounded-xl bg-[#ba1a1a] py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
        >
          {`Excluir ${selecionados.size} atendimento${selecionados.size !== 1 ? 's' : ''}`}
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
