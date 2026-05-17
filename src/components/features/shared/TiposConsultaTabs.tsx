'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type TipoConsulta } from '@/actions/tipos-consulta'
import { type ProtocoloAtendimento } from '@/actions/protocolos-atendimento'
import { ProtocolosAtendimentoManager } from './ProtocolosAtendimentoManager'
import { TiposConsultaManager } from './TiposConsultaManager'

interface TipoConsultaOption {
  id: string
  nome: string
  ativo: boolean
}

interface TiposConsultaTabsProps {
  tipos: TipoConsulta[]
  protocolosAtendimento: ProtocoloAtendimento[]
  tiposAtivos: TipoConsultaOption[]
}

export function TiposConsultaTabs({
  tipos,
  protocolosAtendimento,
  tiposAtivos,
}: TiposConsultaTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const abaDaUrl = searchParams.get('tab') === 'protocolos' ? 'protocolos' : 'tipos'
  const [abaAtiva, setAbaAtiva] = useState<'tipos' | 'protocolos'>(abaDaUrl)

  useEffect(() => {
    setAbaAtiva(abaDaUrl)
  }, [abaDaUrl])

  function trocarAba(aba: 'tipos' | 'protocolos') {
    setAbaAtiva(aba)

    const nextParams = new URLSearchParams(searchParams.toString())
    if (aba === 'protocolos') {
      nextParams.set('tab', 'protocolos')
    } else {
      nextParams.delete('tab')
    }

    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="overflow-hidden">
      <div className="border-b border-border px-6 pt-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => trocarAba('tipos')}
            className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${
              abaAtiva === 'tipos'
                ? 'bg-primary-500 text-white'
                : 'bg-page text-text-primary border border-border border-b-0'
            }`}
          >
            Tipos de consulta
          </button>
          <button
            type="button"
            onClick={() => trocarAba('protocolos')}
            className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${
              abaAtiva === 'protocolos'
                ? 'bg-primary-500 text-white'
                : 'bg-page text-text-primary border border-border border-b-0'
            }`}
          >
            Protocolos de atendimento
          </button>
        </div>
      </div>

      {abaAtiva === 'tipos' ? (
        <div className="p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-text-primary">Tipos de consulta</h2>
            <p className="text-sm text-text-secondary mt-1">
              Cadastre os tipos disponiveis para os atendimentos individuais.
            </p>
          </div>
          <TiposConsultaManager tipos={tipos} />
        </div>
      ) : (
        <div className="p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-text-primary">Protocolos de atendimento</h2>
            <p className="text-sm text-text-secondary mt-1">
              Monte combinações prontas de tipos de consulta.
            </p>
          </div>
          <ProtocolosAtendimentoManager
            protocolos={protocolosAtendimento}
            tiposConsulta={tiposAtivos}
          />
        </div>
      )}
    </div>
  )
}
