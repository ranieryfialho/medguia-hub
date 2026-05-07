'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Calendar, Users } from 'lucide-react'

type FiltrosRelatorioProps = {
  profissionais: { id: string; nome: string }[]
  isGestor: boolean
  paramsAtuais: Record<string, string | string[] | undefined>
}

const PERIODOS = [
  { valor: 'esta-semana', label: 'Esta semana' },
  { valor: 'este-mes', label: 'Este mês' },
  { valor: 'mes-passado', label: 'Mês passado' },
  { valor: 'personalizado', label: 'Personalizado' },
]

export function FiltrosRelatorio({
  profissionais,
  isGestor,
  paramsAtuais,
}: FiltrosRelatorioProps) {
  const router = useRouter()

  const periodoProp = typeof paramsAtuais.periodo === 'string' ? paramsAtuais.periodo : 'este-mes'
  const profissionalProp = typeof paramsAtuais.profissional === 'string' ? paramsAtuais.profissional : 'todos'
  const deProp = typeof paramsAtuais.de === 'string' ? paramsAtuais.de : format(new Date(), 'yyyy-MM-dd')
  const ateProp = typeof paramsAtuais.ate === 'string' ? paramsAtuais.ate : format(new Date(), 'yyyy-MM-dd')

  const [periodo, setPeriodo] = useState(periodoProp)
  const [profissional, setProfissional] = useState(profissionalProp)
  const [de, setDe] = useState(deProp)
  const [ate, setAte] = useState(ateProp)

  const updateFilters = (newPeriodo?: string, newProfissional?: string, newDe?: string, newAte?: string) => {
    const params = new URLSearchParams()
    const p = newPeriodo ?? periodo
    params.set('periodo', p)
    if (p === 'personalizado') {
      params.set('de', newDe ?? de)
      params.set('ate', newAte ?? ate)
    }
    if (isGestor) {
      params.set('profissional', newProfissional ?? profissional)
    }
    router.push(`/relatorios/tempo-fabril?${params.toString()}`)
  }

  const handlePeriodoChange = (novoPeriodo: string) => {
    setPeriodo(novoPeriodo)
    updateFilters(novoPeriodo, undefined, de, ate)
  }

  const handleProfissionalChange = (novoProf: string) => {
    setProfissional(novoProf)
    updateFilters(undefined, novoProf, de, ate)
  }

  const handleDeChange = (novaData: string) => {
    setDe(novaData)
    updateFilters(undefined, undefined, novaData, ate)
  }

  const handleAteChange = (novaData: string) => {
    setAte(novaData)
    updateFilters(undefined, undefined, de, novaData)
  }

  return (
    <div className="bg-gradient-to-r from-[#f0f5f4] to-white rounded-2xl border border-[#bcc9c4]/30 p-4 md:p-6 print:hidden shadow-sm">
      {/* Grid responsivo */}
      <div className="space-y-5">
        {/* Período */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-[#006b5a]" />
            <label className="text-sm font-semibold text-[#171d1c]">Período</label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PERIODOS.map(p => (
              <button
                key={p.valor}
                onClick={() => handlePeriodoChange(p.valor)}
                className={`px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
                  periodo === p.valor
                    ? 'bg-[#006b5a] text-white shadow-md'
                    : 'bg-white text-[#3d4945] border border-[#bcc9c4]/50 hover:border-[#006b5a]/50 hover:bg-[#f9faf8]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date pickers - condicionais */}
        {periodo === 'personalizado' && (
          <div className="bg-white rounded-lg p-4 border border-[#bcc9c4]/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#3d4945] mb-2">Data inicial</label>
                <input
                  type="date"
                  value={de}
                  onChange={e => handleDeChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#bcc9c4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a] focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#3d4945] mb-2">Data final</label>
                <input
                  type="date"
                  value={ate}
                  onChange={e => handleAteChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#bcc9c4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a] focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Profissional - só para gestor */}
        {isGestor && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-[#006b5a]" />
              <label className="text-sm font-semibold text-[#171d1c]">Profissional</label>
            </div>
            <select
              value={profissional}
              onChange={e => handleProfissionalChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#bcc9c4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a] focus:border-transparent bg-white text-[#171d1c] transition-all appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23006b5a%22 stroke-width=%222%22%3e%3cpolyline points=%226 9 12 15 18 9%3e%3c/polyline%3e%3c/svg%3e')] bg-no-repeat bg-right bg-[length:20px] pr-8"
            >
              <option value="todos">Todos os profissionais</option>
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        )}

      </div>
    </div>
  )
}
