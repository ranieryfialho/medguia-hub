import Link from 'next/link'

type FiltrosPreConsultasProps = {
  aba: 'pendentes' | 'historico'
  busca: string
  medicoId: string
  fisioId: string
  dataInicio: string
  dataFim: string
  medicos: Array<{ id: string; nome: string }>
  fisioterapeutas: Array<{ id: string; nome: string }>
}

export function FiltrosPreConsultas({
  aba,
  busca,
  medicoId,
  fisioId,
  dataInicio,
  dataFim,
  medicos,
  fisioterapeutas,
}: FiltrosPreConsultasProps) {
  const temFiltroAtivo = !!busca || !!medicoId || !!fisioId || !!dataInicio || !!dataFim

  return (
    <form method="get" className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <input type="hidden" name="aba" value={aba} />
      <div className="flex items-end gap-3 flex-wrap">
        <div className="min-w-[200px] flex-1">
          <label className="block text-xs text-slate-500 uppercase mb-1">Buscar paciente</label>
          <input
            type="text"
            name="busca"
            defaultValue={busca}
            placeholder="Nome do paciente"
            className="w-full px-3 py-2 bg-white border border-[#bcc9c4] rounded-lg text-sm focus:outline-none focus:border-[#006b5a]"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 uppercase mb-1">Médico</label>
          <select
            name="medico_id"
            defaultValue={medicoId}
            className="px-3 py-2 bg-white border border-[#bcc9c4] rounded-lg text-sm focus:outline-none focus:border-[#006b5a]"
          >
            <option value="">Todos</option>
            {medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 uppercase mb-1">Fisioterapeuta</label>
          <select
            name="fisio_id"
            defaultValue={fisioId}
            className="px-3 py-2 bg-white border border-[#bcc9c4] rounded-lg text-sm focus:outline-none focus:border-[#006b5a]"
          >
            <option value="">Todos</option>
            {fisioterapeutas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 uppercase mb-1">De</label>
          <input
            type="date"
            name="data_inicio"
            defaultValue={dataInicio}
            className="px-3 py-2 bg-white border border-[#bcc9c4] rounded-lg text-sm focus:outline-none focus:border-[#006b5a]"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 uppercase mb-1">Até</label>
          <input
            type="date"
            name="data_fim"
            defaultValue={dataFim}
            className="px-3 py-2 bg-white border border-[#bcc9c4] rounded-lg text-sm focus:outline-none focus:border-[#006b5a]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-[#006b5a] hover:bg-[#004f43] text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Filtrar
        </button>
        {temFiltroAtivo && (
          <Link
            href={`/pre-consultas?aba=${aba}`}
            className="px-4 py-2 bg-white hover:bg-[#dee3e3] border border-[#bcc9c4] text-[#3d4945] rounded-lg text-sm transition-colors"
          >
            Limpar
          </Link>
        )}
      </div>
    </form>
  )
}
