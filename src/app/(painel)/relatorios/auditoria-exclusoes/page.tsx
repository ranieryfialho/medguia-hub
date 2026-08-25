import { redirect } from 'next/navigation'
import { ShieldAlert, Trash2 } from 'lucide-react'
import { getUsuarioComPermissoes } from '@/lib/guard'
import { isGestorSistema } from '@/lib/permissoes'
import { formatAppDate, formatAppTime, getAppDayRangeUTC } from '@/lib/datetime'
import {
  buscarLogsAuditoriaExclusoes,
  listarOpcoesFiltroAuditoria,
  AUDITORIA_EXCLUSOES_PAGE_SIZE,
} from '@/actions/relatorios-auditoria'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

const ACAO_LABEL: Record<string, string> = {
  exclusao_avulso: 'Agendamento avulso',
  exclusao_sessao_recorrente: 'Sessão pontual (recorrência)',
  exclusao_serie_completa: 'Série completa',
  exclusao_lote: 'Lote de atendimentos',
}

function formatarDataHora(valor: string | null): string {
  if (!valor) return '—'
  return `${formatAppDate(valor)} às ${formatAppTime(valor)}`
}

export default async function AuditoriaExclusoesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { profile } = await getUsuarioComPermissoes()

  // AC-059: painel restrito a gestor do sistema — usuário sem esse perfil não acessa.
  if (!isGestorSistema(profile?.nivel_acesso)) {
    redirect('/dashboard')
  }

  const params = await searchParams

  const dataInicio = typeof params.data_inicio === 'string' ? params.data_inicio : ''
  const dataFim = typeof params.data_fim === 'string' ? params.data_fim : ''
  const profissionalId = typeof params.profissional_id === 'string' ? params.profissional_id : ''
  const usuarioId = typeof params.usuario_id === 'string' ? params.usuario_id : ''
  const motivoCategoria = typeof params.motivo_categoria === 'string' ? params.motivo_categoria : ''
  const pagina = Math.max(1, Number(typeof params.pagina === 'string' ? params.pagina : '1') || 1)

  const [{ profissionais, operadores, motivos }, { logs, total }] = await Promise.all([
    listarOpcoesFiltroAuditoria(),
    // AC-060: os 4 filtros (período, profissional, operador, motivo) se combinam
    // simultaneamente — só aparece log que atenda a todos os filtros aplicados.
    buscarLogsAuditoriaExclusoes({
      dataInicio: dataInicio ? getAppDayRangeUTC(dataInicio).start : undefined,
      dataFim: dataFim ? getAppDayRangeUTC(dataFim).end : undefined,
      profissionalId: profissionalId || undefined,
      usuarioId: usuarioId || undefined,
      motivoCategoria: motivoCategoria || undefined,
      pagina,
    }),
  ])

  const totalPaginas = Math.max(1, Math.ceil(total / AUDITORIA_EXCLUSOES_PAGE_SIZE))
  const queryFiltrosAtuais = new URLSearchParams()
  if (dataInicio) queryFiltrosAtuais.set('data_inicio', dataInicio)
  if (dataFim) queryFiltrosAtuais.set('data_fim', dataFim)
  if (profissionalId) queryFiltrosAtuais.set('profissional_id', profissionalId)
  if (usuarioId) queryFiltrosAtuais.set('usuario_id', usuarioId)
  if (motivoCategoria) queryFiltrosAtuais.set('motivo_categoria', motivoCategoria)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-[#006b5a]/10 flex items-center justify-center shrink-0">
          <Trash2 size={20} className="text-[#006b5a]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#006b5a]">Auditoria de Exclusões</h2>
          <p className="text-xs text-slate-500">Exclusões de agendamento por período, profissional, operador e motivo</p>
        </div>
      </div>

      <form
        method="get"
        action="/relatorios/auditoria-exclusoes"
        className="flex flex-wrap items-end gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Data início</label>
          <input
            type="date"
            name="data_inicio"
            defaultValue={dataInicio}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Data fim</label>
          <input
            type="date"
            name="data_fim"
            defaultValue={dataFim}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Profissional</label>
          <select
            name="profissional_id"
            defaultValue={profissionalId}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          >
            <option value="">Todos</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Operador</label>
          <select
            name="usuario_id"
            defaultValue={usuarioId}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          >
            <option value="">Todos</option>
            {operadores.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Motivo</label>
          <select
            name="motivo_categoria"
            defaultValue={motivoCategoria}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          >
            <option value="">Todos</option>
            {motivos.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-[#006b5a] hover:bg-[#005a4b] text-white rounded-lg text-sm font-medium transition-colors self-end"
        >
          Filtrar
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          {total} {total === 1 ? 'exclusão encontrada' : 'exclusões encontradas'}
        </p>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <ShieldAlert size={32} className="text-slate-200" />
            <p className="text-sm font-semibold text-[#3d4945]">Nenhuma exclusão encontrada para os filtros aplicados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const dados = log.dados_agendamento
              const sessaoInfo = dados.numero_sessao && dados.total_sessoes
                ? ` — Sessão ${dados.numero_sessao}/${dados.total_sessoes}`
                : ''
              return (
                <div key={log.id} className="rounded-xl border border-slate-100 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#083142]">
                      {ACAO_LABEL[log.acao] ?? log.acao}
                    </p>
                    <p className="text-[10px] text-[#6d7a75]">{formatarDataHora(log.criado_em)}</p>
                  </div>

                  <p className="mt-1 text-[11px] text-[#6d7a75]">
                    Paciente <span className="font-semibold text-[#3d4945]">{log.paciente_nome ?? 'Desconhecido'}</span>
                    {' · '}
                    Profissional <span className="font-semibold text-[#3d4945]">{log.profissional_nome ?? 'Desconhecido'}</span>
                  </p>

                  <p className="mt-1 text-[11px] text-[#6d7a75]">
                    Excluído por <span className="font-semibold text-[#3d4945]">{log.usuario_nome ?? 'Usuário desconhecido'}</span>
                  </p>

                  <p className="mt-1 text-[11px] text-[#6d7a75]">
                    Motivo: <span className="font-semibold text-[#3d4945]">{log.motivo_categoria_label}</span>
                    {log.motivo_observacao ? ` — ${log.motivo_observacao}` : ''}
                  </p>

                  <p className="mt-1 text-[11px] text-[#6d7a75]">
                    Sessão apagada: {dados.tipo ?? 'Sessão'}{sessaoInfo}, {formatarDataHora(dados.data_agendamento)}, status {dados.status ?? '—'}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {totalPaginas > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>Página {pagina} de {totalPaginas}</span>
            <div className="flex gap-2">
              {pagina > 1 && (
                <a
                  href={`/relatorios/auditoria-exclusoes?${new URLSearchParams({ ...Object.fromEntries(queryFiltrosAtuais), pagina: String(pagina - 1) })}`}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  Anterior
                </a>
              )}
              {pagina < totalPaginas && (
                <a
                  href={`/relatorios/auditoria-exclusoes?${new URLSearchParams({ ...Object.fromEntries(queryFiltrosAtuais), pagina: String(pagina + 1) })}`}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  Próxima
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
