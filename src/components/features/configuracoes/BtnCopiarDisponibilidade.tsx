'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

type HoraEntry = { hora: number; nomes: string[] }

interface Props {
  diaLabel: string
  horas: HoraEntry[]
}

export function BtnCopiarDisponibilidade({ diaLabel, horas }: Props) {
  const [copiado, setCopiado] = useState(false)

  function gerarMensagem() {
    const linhas: string[] = [
      `📅 DISPONIBILIDADE – ${diaLabel.toUpperCase()}`,
      '',
      'Segue a disponibilidade dos profissionais para avaliações:',
      '',
    ]

    for (const { hora, nomes } of horas) {
      linhas.push(`🕗 ${hora.toString().padStart(2, '0')}H`)
      for (const nome of nomes) {
        linhas.push(`* ${nome}`)
      }
    }

    linhas.push('')
    linhas.push('Avaliações após esses horários: consultar a disponibilidade do profissional desejado.')

    return linhas.join('\n')
  }

  async function copiar() {
    await navigator.clipboard.writeText(gerarMensagem())
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <button
      onClick={copiar}
      title="Copiar disponibilidade deste dia para o WhatsApp"
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all border ${
        copiado
          ? 'bg-[#006b5a] text-white border-[#006b5a]'
          : 'bg-white text-slate-400 border-slate-200 hover:border-[#006b5a]/40 hover:text-[#006b5a]'
      }`}
    >
      {copiado ? <Check size={11} /> : <Copy size={11} />}
      {copiado ? 'Copiado!' : 'Copiar'}
    </button>
  )
}