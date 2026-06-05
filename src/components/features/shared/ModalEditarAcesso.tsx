'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { atualizarConfiguracaoAcessoUsuario } from '@/actions/acessos'
import {
  GRUPOS_MODULOS,
  TODOS_MODULOS,
  TEMPLATES_PERFIL,
  obterTemplatePerfilPadrao,
  obterModulosDoTemplate,
  inferirTemplatePerfilPorModulos,
  type CargoColaborador,
  type ModuloChave,
  type NivelAcesso,
  type TemplatePerfilChave,
} from '@/lib/modulos'

type UsuarioAcesso = {
  id: string
  nome: string
  email: string
  cargo: CargoColaborador
  cargoLabel: string
  nivelAcesso: NivelAcesso
  modulosLiberados: string[]
}

const OPCOES_CARGO: Array<{ value: CargoColaborador; label: string }> = [
  { value: 'fisioterapeuta', label: 'Fisioterapeuta' },
  { value: 'recepcionista', label: 'Recepcionista' },
  { value: 'medico', label: 'Médico' },
  { value: 'gestor', label: 'Gestor' },
]

const OPCOES_NIVEL: Array<{ value: NivelAcesso; label: string }> = [
  { value: 'basico', label: 'Básico' },
  { value: 'gestor', label: 'Gestor do sistema' },
  { value: 'master', label: 'Master' },
]

const TEMPLATES_VISIVEIS: Array<{ chave: TemplatePerfilChave; label: string }> = [
  { chave: 'fisioterapeuta', label: 'Fisioterapeuta' },
  { chave: 'recepcionista', label: 'Recepção' },
  { chave: 'medico', label: 'Médico' },
  { chave: 'gestor', label: 'Gestor' },
  { chave: 'comercial', label: 'Comercial' },
  { chave: 'completo', label: 'Completo' },
]

function modulosIniciais(usuario: UsuarioAcesso): ModuloChave[] {
  // Usuário legado (array vazio) → acesso completo por compatibilidade
  if (usuario.modulosLiberados.length === 0) {
    return obterModulosDoTemplate('completo')
  }
  return usuario.modulosLiberados as ModuloChave[]
}

export function ModalEditarAcesso({ usuario }: { usuario: UsuarioAcesso }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [cargo, setCargo] = useState<CargoColaborador>(usuario.cargo)
  const [nivelAcesso, setNivelAcesso] = useState<NivelAcesso>(usuario.nivelAcesso)
  const [selecionados, setSelecionados] = useState<ModuloChave[]>(() => modulosIniciais(usuario))
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()

  const templateAtual = inferirTemplatePerfilPorModulos(selecionados)
  const isLegado = usuario.modulosLiberados.length === 0

  function abrir() {
    setCargo(usuario.cargo)
    setNivelAcesso(usuario.nivelAcesso)
    setSelecionados(modulosIniciais(usuario))
    setGruposAbertos({})
    setAberto(true)
  }

  function alternarModulo(chave: ModuloChave) {
    setSelecionados(prev =>
      prev.includes(chave) ? prev.filter(m => m !== chave) : [...prev, chave]
    )
  }

  function aplicarTemplate(template: TemplatePerfilChave) {
    setSelecionados(obterModulosDoTemplate(template))
  }

  function toggleGrupo(chaveGrupo: string) {
    const grupo = GRUPOS_MODULOS.find(g => g.chave_grupo === chaveGrupo)
    if (!grupo) return
    const chaves = grupo.modulos.map(m => m.chave)
    const todosAtivos = chaves.every(c => selecionados.includes(c))
    if (todosAtivos) {
      setSelecionados(prev => prev.filter(s => !chaves.includes(s as ModuloChave)))
    } else {
      setSelecionados(prev => [...new Set([...prev, ...chaves])])
    }
  }

  function toggleAccordion(chaveGrupo: string) {
    setGruposAbertos(prev => ({ ...prev, [chaveGrupo]: !prev[chaveGrupo] }))
  }

  function salvar() {
    startTransition(async () => {
      const result = await atualizarConfiguracaoAcessoUsuario({
        usuarioId: usuario.id,
        cargo,
        nivelAcesso,
        modulos: selecionados,
      })
      if (result?.error) { toast.error(result.error); return }
      toast.success('Permissões atualizadas')
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="rounded-lg bg-[#cce2da]/60 px-3 py-2 text-sm font-bold text-[#006b5a] transition-colors hover:bg-[#cce2da]"
      >
        Editar acessos
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setAberto(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header fixo */}
            <div className="flex items-start justify-between gap-4 border-b border-[#bcc9c4]/30 px-6 py-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#006b5a]">Gestão de Acessos</p>
                <h3 className="mt-1 text-xl font-bold text-[#171d1c]">{usuario.nome}</h3>
                <p className="mt-0.5 text-sm text-[#3d4945]/70">{usuario.email}</p>
                {isLegado && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 inline-block">
                    Usuário legado — módulos serão explicitados ao salvar
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-xl p-2 text-[#3d4945]/60 transition-colors hover:bg-[#f0f5f4] hover:text-[#171d1c]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Cargo e Nível */}
              <div className="grid gap-4 rounded-2xl border border-[#bcc9c4]/30 bg-[#fbfdfd] p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#6d7a75]">Perfil Operacional</label>
                  <select
                    value={cargo}
                    onChange={e => setCargo(e.target.value as CargoColaborador)}
                    className="w-full rounded-xl border border-[#bcc9c4]/50 bg-white px-3 py-2.5 text-sm font-medium text-[#171d1c] focus:border-[#006b5a] focus:outline-none"
                  >
                    {OPCOES_CARGO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#6d7a75]">Nível do Sistema</label>
                  <select
                    value={nivelAcesso}
                    onChange={e => setNivelAcesso(e.target.value as NivelAcesso)}
                    className="w-full rounded-xl border border-[#bcc9c4]/50 bg-white px-3 py-2.5 text-sm font-medium text-[#171d1c] focus:border-[#006b5a] focus:outline-none"
                  >
                    {OPCOES_NIVEL.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {nivelAcesso === 'master' && (
                    <p className="text-xs font-semibold text-amber-700">Master recebe todos os módulos automaticamente.</p>
                  )}
                </div>
              </div>

              {/* Seletor de template */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#6d7a75]">Perfil de Acesso</span>
                  <span className="text-xs text-[#3d4945]/60">
                    {selecionados.length}/{TODOS_MODULOS.length} módulos
                    {templateAtual !== 'customizado' && ` · ${TEMPLATES_PERFIL[templateAtual]?.label ?? templateAtual}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES_VISIVEIS.map(t => {
                    const ativo = templateAtual === t.chave
                    return (
                      <button
                        key={t.chave}
                        type="button"
                        onClick={() => aplicarTemplate(t.chave)}
                        className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                          ativo
                            ? 'bg-[#006b5a] text-white shadow-md shadow-[#006b5a]/20'
                            : 'border border-[#bcc9c4]/60 bg-white text-[#3d4945] hover:border-[#006b5a]/40 hover:text-[#006b5a]'
                        }`}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                  {templateAtual === 'customizado' && (
                    <span className="rounded-full border border-dashed border-[#3d4945]/30 bg-[#f7f9f8] px-4 py-1.5 text-sm font-bold text-[#3d4945]/60">
                      Personalizado
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => aplicarTemplate(obterTemplatePerfilPadrao(cargo, nivelAcesso))}
                    className="ml-auto rounded-full border border-[#006b5a]/20 px-4 py-1.5 text-sm font-bold text-[#006b5a] hover:bg-[#f0fcf9] transition-colors"
                  >
                    Padrão do cargo
                  </button>
                </div>
              </div>

              {/* Grupos de módulos */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#6d7a75]">Módulos</span>
                {GRUPOS_MODULOS.map(grupo => {
                  const chaves = grupo.modulos.map(m => m.chave)
                  const qtdAtivos = chaves.filter(c => selecionados.includes(c)).length
                  const todosAtivos = qtdAtivos === chaves.length
                  const aberto = gruposAbertos[grupo.chave_grupo] !== false // aberto por padrão

                  return (
                    <div key={grupo.chave_grupo} className="rounded-2xl border border-[#bcc9c4]/30 overflow-hidden">
                      {/* Cabeçalho do grupo */}
                      <div className="flex items-center gap-3 bg-[#f7f9f8] px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleAccordion(grupo.chave_grupo)}
                          className="flex flex-1 items-center gap-2 text-left"
                        >
                          {aberto ? <ChevronDown size={14} className="text-[#3d4945]/50 shrink-0" /> : <ChevronRight size={14} className="text-[#3d4945]/50 shrink-0" />}
                          <span className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#3d4945]">{grupo.label}</span>
                          <span className="text-xs text-[#3d4945]/50">{qtdAtivos}/{chaves.length}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleGrupo(grupo.chave_grupo)}
                          className={`shrink-0 rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                            todosAtivos
                              ? 'bg-[#006b5a]/10 text-[#006b5a] hover:bg-[#006b5a]/20'
                              : 'bg-white border border-[#bcc9c4]/50 text-[#3d4945] hover:border-[#006b5a]/40 hover:text-[#006b5a]'
                          }`}
                        >
                          {todosAtivos ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                      </div>

                      {/* Módulos do grupo */}
                      {aberto && (
                        <div className="grid gap-2 p-3 md:grid-cols-2">
                          {grupo.modulos.map(modulo => {
                            const checked = selecionados.includes(modulo.chave)
                            return (
                              <label
                                key={modulo.chave}
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                                  checked
                                    ? 'border-[#006b5a]/40 bg-[#eaf7f3]'
                                    : 'border-[#bcc9c4]/40 bg-white hover:bg-[#f7faf9]'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => alternarModulo(modulo.chave)}
                                  className="mt-0.5 h-4 w-4 rounded border-[#bcc9c4] text-[#006b5a] focus:ring-[#006b5a]"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-[#171d1c]">{modulo.label}</p>
                                  <p className="text-xs text-[#3d4945]/55">{modulo.rota}</p>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer fixo */}
            <div className="flex flex-col-reverse gap-3 border-t border-[#bcc9c4]/30 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-[#3d4945] transition-colors hover:bg-[#f0f5f4]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={isPending}
                className="rounded-xl bg-gradient-to-r from-[#006b5a] to-[#33a68f] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#006b5a]/20 transition-opacity hover:opacity-90 disabled:opacity-70"
              >
                {isPending ? 'Salvando...' : 'Salvar permissões'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
