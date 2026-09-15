import { formatAppDate, formatAppTime } from '@/lib/datetime'
import { normalizeAtendimentoStatus, isStatusFabril, isStatusNaoEfetivo } from '@/lib/atendimento-status'

export type HistoricoPreConsulta = {
  id: string
  tipo: string
  status: string | null
  direcao_encaminhamento: 'pre' | 'pos' | null
  data_agendamento: string | null
  paciente: { id: string; nome: string; telefone: string | null } | null
  fisioterapeutaNome: string | null
  origem: { data_agendamento: string; profissionalNome: string | null } | null
}

function statusBadgeClasses(status: string | null) {
  if (isStatusFabril(status)) return 'bg-emerald-100 text-emerald-700'
  if (isStatusNaoEfetivo(status)) return 'bg-slate-200 text-slate-600'
  return 'bg-sky-100 text-sky-700'
}

export function TabelaHistoricoPreConsultas({ itens }: { itens: HistoricoPreConsulta[] }) {
  if (itens.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
        <p className="text-slate-500 font-medium">Nenhum registro encontrado para os filtros selecionados.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">Paciente</th>
              <th className="text-left px-4 py-3">Direção</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Fisioterapeuta</th>
              <th className="text-left px-4 py-3">Médico de origem</th>
              <th className="text-left px-4 py-3 whitespace-nowrap">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itens.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{item.paciente?.nome ?? 'Paciente'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                      item.direcao_encaminhamento === 'pos'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-[#e6f4f1] text-[#006b5a]'
                    }`}
                  >
                    {item.direcao_encaminhamento === 'pos' ? 'Pós-consulta' : 'Pré-consulta'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${statusBadgeClasses(item.status)}`}>
                    {normalizeAtendimentoStatus(item.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{item.fisioterapeutaNome ?? '—'}</td>
                <td className="px-4 py-3 text-slate-700">
                  {item.origem ? (
                    <>
                      {item.origem.profissionalNome ?? 'Médico'}
                      <span className="block text-xs text-slate-400">
                        {formatAppDate(item.origem.data_agendamento)} às {formatAppTime(item.origem.data_agendamento)}
                      </span>
                    </>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                  {item.data_agendamento
                    ? `${formatAppDate(item.data_agendamento)} ${formatAppTime(item.data_agendamento)}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
