'use client'

import { CalendarPlus } from 'lucide-react'
import { useAbrirNovoAgendamento } from '@/components/layout/SlideNovoAgendamentoContext'

// Abre o mesmo SlideNovoAgendamento global (montado uma vez em AppShell) em
// vez de criar uma segunda instância própria — evita que este botão e o do
// rodapé do menu lateral tenham comportamentos diferentes com o tempo.
export function BotaoAbrirNovoAgendamento() {
  const abrir = useAbrirNovoAgendamento()

  return (
    <button
      type="button"
      onClick={abrir}
      className="w-full bg-white text-[#006b5a] border-2 border-[#006b5a] rounded-xl py-3 font-bold flex items-center justify-center gap-2 hover:bg-[#f0f5f4] transition-colors"
    >
      <CalendarPlus size={20} />
      <span>Novo Agendamento</span>
    </button>
  )
}
