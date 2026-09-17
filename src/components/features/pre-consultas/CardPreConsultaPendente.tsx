'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Stethoscope, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatAppDate, formatAppDateKey, formatAppTime } from '@/lib/datetime'
import { atribuirFisioterapeutaPreConsulta, excluirPreConsultaPendente } from '@/actions/pre-consultas'
import { createClient } from '@/lib/supabase/client'
import type { MotivoExclusao } from '@/actions/agenda'
import { somarUmaHora } from '@/components/features/agenda/slide-utils'

type MotivoCatalogoItem = { slug: string; label: string; exige_observacao: boolean }

export type PreConsultaPendente = {
  id: string
  tipo: string
  created_at: string
  direcao_encaminhamento: 'pre' | 'pos' | null
  paciente: { id: string; nome: string; telefone: string | null } | null
  origem: { data_agendamento: string; tipo: string | null; profissionalNome: string | null } | null
}

type Props = {
  pendente: PreConsultaPendente
  fisioterapeutas: { id: string; nome: string }[]
}

export function CardPreConsultaPendente({ pendente, fisioterapeutas }: Props) {
  const router = useRouter()
  const [expandido, setExpandido] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [data, setData] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')

  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [motivosCatalogo, setMotivosCatalogo] = useState<MotivoCatalogoItem[] | null>(null)
  const [carregandoMotivos, setCarregandoMotivos] = useState(false)
  const [motivoCategoria, setMotivoCategoria] = useState<string | null>(null)
  const [motivoObservacao, setMotivoObservacao] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  const categoriaSelecionada = motivosCatalogo?.find((m) => m.slug === motivoCategoria) ?? null
  const motivoValido = !!motivoCategoria && (!categoriaSelecionada?.exige_observacao || motivoObservacao.trim().length > 0)

  async function abrirConfirmacaoExclusao() {
    setConfirmandoExclusao(true)
    setMotivoCategoria(null)
    setMotivoObservacao('')
    if (motivosCatalogo || carregandoMotivos) return
    setCarregandoMotivos(true)
    const supabase = createClient()
    const { data: catalogo, error } = await supabase
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
    setMotivosCatalogo(catalogo ?? [])
  }

  function abrirAtribuicao() {
    setData(pendente.origem ? formatAppDateKey(pendente.origem.data_agendamento) : '')
    setExpandido(true)
  }

  function handleHoraInicioChange(value: string) {
    setHoraInicio(value)
    setHoraFim(somarUmaHora(value))
  }

  function cancelarExclusao() {
    setConfirmandoExclusao(false)
    setMotivoCategoria(null)
    setMotivoObservacao('')
  }

  async function handleExcluir() {
    if (!motivoValido || !motivoCategoria) return

    const motivo: MotivoExclusao = {
      categoria: motivoCategoria,
      observacao: motivoObservacao.trim() ? motivoObservacao.trim() : undefined,
    }

    setExcluindo(true)
    const res = await excluirPreConsultaPendente(pendente.id, motivo)
    setExcluindo(false)

    if (res.error) {
      toast.error(res.error)
      return
    }

    toast.success(`${pendente.paciente?.nome ?? 'Paciente'} — pré/pós-consulta excluída`)
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')

    const formData = new FormData()
    formData.set('profissional_id', profissionalId)
    formData.set('data', data)
    formData.set('hora_inicio', horaInicio)
    formData.set('hora_fim', horaFim)
    formData.set('tipo', pendente.tipo)
    formData.set('observacoes', '')
    formData.set('marcou_retorno', 'off')

    const res = await atribuirFisioterapeutaPreConsulta(pendente.id, formData)
    setSalvando(false)

    if (res.error) {
      setErro(res.error)
      return
    }

    toast.success(`${pendente.paciente?.nome ?? 'Paciente'} — fisioterapeuta atribuído`)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">{pendente.paciente?.nome ?? 'Paciente'}</h3>
            {pendente.direcao_encaminhamento === 'pos' && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
                Pós-consulta
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{pendente.tipo}</p>
          {pendente.origem && (
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <Stethoscope size={12} className="shrink-0 text-[#006b5a]" />
              Consulta médica em {formatAppDate(pendente.origem.data_agendamento)} às {formatAppTime(pendente.origem.data_agendamento)}
              {pendente.origem.profissionalNome ? ` — ${pendente.origem.profissionalNome}` : ''}
            </p>
          )}
        </div>
        {!expandido && !confirmandoExclusao && (
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={abrirConfirmacaoExclusao}
              title="Excluir"
              className="flex items-center justify-center p-2 rounded-lg text-[#ba1a1a] bg-white border border-[#bcc9c4] hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              onClick={abrirAtribuicao}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-[#006b5a] hover:bg-[#004f43] transition-colors"
            >
              <UserPlus size={16} />
              Atribuir fisioterapeuta
            </button>
          </div>
        )}
      </div>

      {confirmandoExclusao && (
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <p className="rounded-lg bg-[#fbeaea] px-3 py-2 text-xs font-semibold text-[#ba1a1a] flex-1">
              Isso vai excluir só esta pré/pós-consulta pendente — a consulta médica de origem não é afetada.
            </p>
            <button
              type="button"
              onClick={cancelarExclusao}
              className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Cancelar exclusão"
            >
              <X size={16} />
            </button>
          </div>

          {carregandoMotivos ? (
            <p className="text-xs text-slate-400">Carregando motivos...</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(motivosCatalogo ?? []).map((m) => (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => setMotivoCategoria(m.slug)}
                  className={`rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                    motivoCategoria === m.slug
                      ? 'bg-[#006b5a]/10 text-[#006b5a]'
                      : 'text-[#3d4945] bg-[#f0f5f4] hover:bg-[#dee3e3]'
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
              rows={2}
              className="w-full rounded-lg border border-[#bcc9c4] px-3 py-2 text-xs text-[#3d4945] focus:outline-none focus:ring-1 focus:ring-[#006b5a]"
            />
          )}

          <div className="flex items-center gap-2 justify-end">
            <button type="button" onClick={cancelarExclusao} className="px-3 py-2 rounded-lg text-sm font-semibold text-[#3d4945] bg-white border border-[#bcc9c4] hover:bg-[#dee3e3]">
              Voltar
            </button>
            <button
              type="button"
              onClick={handleExcluir}
              disabled={!motivoValido || excluindo}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-[#ba1a1a] hover:bg-[#9a1515] disabled:opacity-40 transition-colors"
            >
              {excluindo ? 'Excluindo...' : 'Confirmar exclusão'}
            </button>
          </div>
        </div>
      )}

      {expandido && (
        <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
          <select
            required
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
            className="col-span-2 sm:col-span-2 bg-white border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm font-medium"
          >
            <option value="">Fisioterapeuta</option>
            {fisioterapeutas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <input type="date" required value={data} onChange={(e) => setData(e.target.value)}
            className="bg-white border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm font-medium" />
          <input type="time" required value={horaInicio} onChange={(e) => handleHoraInicioChange(e.target.value)}
            className="bg-white border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm font-medium" />
          <input type="time" required value={horaFim} onChange={(e) => setHoraFim(e.target.value)}
            className="bg-white border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm font-medium" />
          <div className="col-span-2 sm:col-span-5 flex items-center gap-2 justify-end">
            {erro && <p className="text-xs text-red-600 font-medium mr-auto">{erro}</p>}
            <button type="button" onClick={() => setExpandido(false)} className="px-3 py-2 rounded-lg text-sm font-semibold text-[#3d4945] bg-white border border-[#bcc9c4] hover:bg-[#dee3e3]">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-[#006b5a] hover:bg-[#004f43] disabled:opacity-60">
              {salvando ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
