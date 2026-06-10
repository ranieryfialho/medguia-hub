'use client'

import { useState, useEffect, useTransition } from 'react'
import { FolderOpen, Link2, Link2Off, RefreshCw, CheckCircle, AlertCircle, Loader2, ImageIcon, Zap, FolderTree } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  iniciarConexaoGoogleDrive,
  desconectarGoogleDrive,
  buscarStatsMigracao,
  buscarStatusMigracao,
  iniciarMigracao,
  pausarMigracao,
} from '@/actions/google-drive'

type StatusConexao = { conectado: boolean; email?: string; tokenInvalido?: boolean }
type Stats = { total: number; processados: number; restantes: number; error?: string }
type MigrationStatus = 'idle' | 'running' | 'paused' | 'completed'

export function GoogleDriveConfigClient({
  status: statusInicial,
  statsInicial,
  statusMigracaoInicial,
}: {
  status: StatusConexao
  statsInicial: Stats
  statusMigracaoInicial: { status: MigrationStatus; erros: number; ultimoErro?: string }
}) {
  const [status, setStatus] = useState(statusInicial)
  const [stats, setStats] = useState(statsInicial)
  const [statusMigracao, setStatusMigracao] = useState<MigrationStatus>(statusMigracaoInicial.status)
  const [totalErros, setTotalErros]   = useState(statusMigracaoInicial.erros)
  const [ultimoErro, setUltimoErro]   = useState(statusMigracaoInicial.ultimoErro ?? '')
  const [desconectando, setDesconectando] = useState(false)
  const [iniciando, setIniciando] = useState(false)
  const [pausando, setPausando] = useState(false)
  const [conectando, startConectar] = useTransition()

  const migrando = statusMigracao === 'running'
  const progresso = stats.total > 0 ? Math.round((stats.processados / stats.total) * 100) : 0
  const concluido = (statusMigracao === 'completed' || stats.restantes === 0) && stats.total > 0 && stats.restantes === 0

  // Auto-inicia migração quando Drive está conectado, há pendentes e nunca foi iniciada
  useEffect(() => {
    if (
      statusInicial.conectado &&
      !statusInicial.tokenInvalido &&
      statsInicial.restantes > 0 &&
      statusMigracaoInicial.status === 'idle'
    ) {
      handleIniciarMigracao()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll DB every 3 s while migration is running — works even for users who weren't on the page when it started
  useEffect(() => {
    if (statusMigracao !== 'running') return

    const interval = setInterval(async () => {
      const [novasStats, novoStatusMigracao] = await Promise.all([
        buscarStatsMigracao(),
        buscarStatusMigracao(),
      ])
      setStats(novasStats)
      setStatusMigracao(novoStatusMigracao.status)
      setTotalErros(novoStatusMigracao.erros)
      setUltimoErro(novoStatusMigracao.ultimoErro ?? '')
      if (novoStatusMigracao.status === 'completed') {
        toast.success('Migração concluída! Todos os pacientes têm pasta no Drive.')
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [statusMigracao])

  async function handleDesconectar() {
    setDesconectando(true)
    try {
      await desconectarGoogleDrive()
      setStatus({ conectado: false })
      toast.success('Google Drive desconectado')
    } catch {
      toast.error('Erro ao desconectar')
    } finally {
      setDesconectando(false)
    }
  }

  async function handleIniciarMigracao() {
    setIniciando(true)
    // Se status era 'completed' mas ainda há pendentes, reseta antes de iniciar
    if (statusMigracao === 'completed' && stats.restantes > 0) {
      await pausarMigracao() // força 'paused' → iniciarMigracao aceita qualquer status não-running
    }
    try {
      const result = await iniciarMigracao()
      if (result.success) {
        setStatusMigracao('running')
        setTotalErros(0)
        setUltimoErro('')
      } else {
        toast.error(result.error ?? 'Erro ao iniciar migração')
      }
    } finally {
      setIniciando(false)
    }
  }

  async function handlePausar() {
    setPausando(true)
    try {
      await pausarMigracao()
      setStatusMigracao('paused')
      toast('Migração pausada. Clique em retomar para continuar.', { icon: '⏸️' })
    } finally {
      setPausando(false)
    }
  }

  async function handleAtualizarStats() {
    const [novasStats, novoStatusMigracao] = await Promise.all([
      buscarStatsMigracao(),
      buscarStatusMigracao(),
    ])
    setStats(novasStats)
    setStatusMigracao(novoStatusMigracao.status)
    setTotalErros(novoStatusMigracao.erros)
  }

  return (
    <div className="space-y-5">
      {/* Card de conexão */}
      <div className="rounded-2xl border border-[#bcc9c4]/40 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f0f5f4] flex items-center justify-center shrink-0">
            <FolderOpen size={24} className="text-[#006b5a]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-[#083142]">Conta Google Drive</h2>
            {status.conectado ? (
              <div className="mt-1 flex items-center gap-2">
                <CheckCircle size={14} className="text-green-600 shrink-0" />
                <p className="text-sm text-[#3d4945]">
                  Conectado{status.email ? ` como ${status.email}` : ''}
                </p>
              </div>
            ) : status.tokenInvalido ? (
              <div className="mt-1 flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700">
                  Sessão expirada{status.email ? ` (${status.email})` : ''} — reconecte para reativar.
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-[#6d7a75]">
                Nenhuma conta conectada. Clique para autorizar o acesso.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {status.conectado ? (
            <button
              type="button"
              onClick={handleDesconectar}
              disabled={desconectando}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {desconectando ? <Loader2 size={15} className="animate-spin" /> : <Link2Off size={15} />}
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              disabled={conectando}
              onClick={() => startConectar(() => iniciarConexaoGoogleDrive())}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#006b5a] text-white text-sm font-semibold hover:bg-[#005a4b] transition-colors disabled:opacity-70"
            >
              {conectando ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              {conectando ? 'Redirecionando...' : 'Conectar com Google Drive'}
            </button>
          )}
        </div>
      </div>

      {/* Card de migração */}
      {status.conectado && (
        <div className="rounded-2xl border border-[#bcc9c4]/40 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="font-bold text-[#083142]">Migração de pacientes existentes</h2>
            <p className="mt-1 text-sm text-[#6d7a75]">
              Cria pastas no Drive para todos os pacientes cadastrados que ainda não possuem uma.
              O processo continua em segundo plano mesmo que você saia desta página.
            </p>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#f0f5f4] p-3 text-center">
              <p className="text-xl font-extrabold text-[#083142]">{stats.total.toLocaleString('pt-BR')}</p>
              <p className="text-[11px] font-semibold text-[#6d7a75] uppercase tracking-wide">Total</p>
            </div>
            <div className="rounded-xl bg-green-50 p-3 text-center">
              <p className="text-xl font-extrabold text-green-700">{stats.processados.toLocaleString('pt-BR')}</p>
              <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wide">Com pasta</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-xl font-extrabold text-amber-700">{stats.restantes.toLocaleString('pt-BR')}</p>
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Pendentes</p>
            </div>
          </div>

          {/* Barra de progresso */}
          {stats.total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#6d7a75]">Progresso</span>
                <span className="text-xs font-bold text-[#006b5a]">{progresso}%</span>
              </div>
              <div className="h-3 bg-[#f0f5f4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#006b5a] rounded-full transition-all duration-500"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              {totalErros > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle size={12} />
                    {totalErros} erro{totalErros !== 1 ? 's' : ''} — pacientes com erro serão ignorados e podem ser reprocessados depois.
                  </p>
                  {ultimoErro && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-mono break-all">
                      Último erro: {ultimoErro}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {concluido ? (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
              <CheckCircle size={16} />
              Todos os pacientes já possuem pasta no Google Drive.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {migrando ? (
                <button
                  type="button"
                  onClick={handlePausar}
                  disabled={pausando}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  {pausando ? <Loader2 size={15} className="animate-spin" /> : <Loader2 size={15} className="animate-spin" />}
                  Pausar migração
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleIniciarMigracao}
                    disabled={iniciando || stats.restantes === 0}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#006b5a] text-white text-sm font-semibold hover:bg-[#005a4b] transition-colors disabled:opacity-50"
                  >
                    {iniciando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    {stats.processados > 0 ? 'Retomar migração' : 'Iniciar migração'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAtualizarStats}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#bcc9c4] text-[#3d4945] text-sm font-semibold hover:bg-[#f0f5f4] transition-colors"
                  >
                    <RefreshCw size={15} />
                    Atualizar
                  </button>
                </>
              )}
            </div>
          )}

          <div className="rounded-xl bg-[#f8f9fa] border border-[#e9ecef] px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-[#3d4945]">Como funciona</p>
            <ul className="text-xs text-[#6d7a75] space-y-0.5 list-disc list-inside">
              <li>Lotes de 50 pacientes por vez, com intervalo entre chamadas à API do Drive</li>
              <li>Continua rodando em segundo plano mesmo que você saia desta página</li>
              <li>O status é compartilhado — qualquer usuário pode ver e pausar a migração</li>
              <li>Pacientes processados são salvos imediatamente — sem risco de duplicação</li>
              <li>Estrutura: <span className="font-mono">MedGuia - Pacientes / Nome do Paciente [ID]</span></li>
            </ul>
          </div>
        </div>
      )}

      {/* Visão geral da funcionalidade */}
      {!status.conectado && (
        <div className="space-y-4">

          {/* O que é */}
          <div className="rounded-2xl border border-[#bcc9c4]/40 bg-white p-6 space-y-4">
            <h3 className="font-bold text-[#083142]">O que essa integração faz</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#f0f5f4] p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-[#006b5a]/10 flex items-center justify-center">
                  <FolderTree size={16} className="text-[#006b5a]" />
                </div>
                <p className="text-xs font-bold text-[#083142]">Organização automática</p>
                <p className="text-xs text-[#6d7a75] leading-relaxed">
                  Cada paciente e cada consulta recebem uma pasta própria no seu Google Drive.
                </p>
              </div>
              <div className="rounded-xl bg-[#f0f5f4] p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-[#006b5a]/10 flex items-center justify-center">
                  <Zap size={16} className="text-[#006b5a]" />
                </div>
                <p className="text-xs font-bold text-[#083142]">Criação ao agendar</p>
                <p className="text-xs text-[#6d7a75] leading-relaxed">
                  Ao criar um agendamento, as pastas já são geradas automaticamente, prontas para receber arquivos.
                </p>
              </div>
              <div className="rounded-xl bg-[#f0f5f4] p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-[#006b5a]/10 flex items-center justify-center">
                  <ImageIcon size={16} className="text-[#006b5a]" />
                </div>
                <p className="text-xs font-bold text-[#083142]">Acesso direto</p>
                <p className="text-xs text-[#6d7a75] leading-relaxed">
                  Cada card de agendamento e de jornada do paciente exibe um atalho direto para a pasta de mídia.
                </p>
              </div>
            </div>
          </div>

          {/* Estrutura de pastas */}
          <div className="rounded-2xl border border-[#bcc9c4]/40 bg-white p-6 space-y-3">
            <h3 className="font-bold text-[#083142]">Como as pastas são organizadas</h3>
            <p className="text-xs text-[#6d7a75]">Tudo fica dentro de uma pasta raiz criada automaticamente no Drive da conta conectada.</p>
            <div className="rounded-xl bg-[#f8f9fa] border border-[#e9ecef] p-4 font-mono text-xs text-[#3d4945] space-y-1.5">
              <p className="font-bold text-[#006b5a]">📁 MedGuia - Pacientes</p>
              <p className="pl-4 text-[#6d7a75]">└── 📁 João Silva [ABC12345]</p>
              <p className="pl-10 text-[#6d7a75]">├── 📁 2025-05-10 - Fisioterapia</p>
              <p className="pl-10 text-[#6d7a75]">├── 📁 2025-05-17 - Fisioterapia</p>
              <p className="pl-10 text-[#6d7a75]">└── 📁 2025-05-24 - Avaliação</p>
              <p className="pl-4 text-[#6d7a75]">└── 📁 Maria Souza [DEF67890]</p>
              <p className="pl-10 text-[#6d7a75]">└── 📁 2025-05-28 - Consulta</p>
            </div>
          </div>

          {/* Passos para ativar */}
          <div className="rounded-2xl border border-[#bcc9c4]/40 bg-white p-6 space-y-4">
            <h3 className="font-bold text-[#083142]">Como ativar</h3>
            <ol className="space-y-3">
              {[
                { passo: '1', titulo: 'Configure as credenciais Google', desc: 'Um desenvolvedor precisa criar um projeto no Google Cloud Console, ativar a Drive API e gerar as credenciais OAuth2. Isso é feito uma única vez.' },
                { passo: '2', titulo: 'Conecte sua conta', desc: 'Clique em "Conectar com Google Drive" acima e autorize o acesso. O MedGuia passa a ter permissão para criar e organizar pastas no Drive da conta escolhida.' },
                { passo: '3', titulo: 'Migre os pacientes existentes', desc: 'Pacientes já cadastrados não têm pastas ainda. Use o botão "Iniciar migração" que aparecerá após conectar para criar as pastas em lote.' },
                { passo: '4', titulo: 'Pronto — tudo automático', desc: 'Novos agendamentos já criam as pastas automaticamente. Acesse as mídias direto dos cards na agenda ou na jornada do paciente.' },
              ].map(({ passo, titulo, desc }) => (
                <li key={passo} className="flex gap-4">
                  <span className="w-6 h-6 rounded-full bg-[#006b5a] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">{passo}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#083142]">{titulo}</p>
                    <p className="text-xs text-[#6d7a75] leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

        </div>
      )}
    </div>
  )
}
