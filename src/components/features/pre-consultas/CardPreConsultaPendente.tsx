'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Stethoscope } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatAppDate, formatAppTime } from '@/lib/datetime'
import { atribuirFisioterapeutaPreConsulta } from '@/actions/pre-consultas'

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
        {!expandido && (
          <button
            type="button"
            onClick={() => setExpandido(true)}
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-[#006b5a] hover:bg-[#004f43] transition-colors"
          >
            <UserPlus size={16} />
            Atribuir fisioterapeuta
          </button>
        )}
      </div>

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
          <input type="time" required value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)}
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
