'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import { atualizarConfiguracaoAcessoUsuario } from '@/actions/acessos'
import {
  GRUPOS_MODULOS,
  TODOS_MODULOS,
  obterTemplatePerfilPadrao,
  obterModulosDoTemplate,
  type CargoColaborador,
  type ModuloChave,
  type NivelAcesso,
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

export function ModalEditarAcesso({ usuario }: { usuario: UsuarioAcesso }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [cargo, setCargo] = useState<CargoColaborador>(usuario.cargo)
  const [nivelAcesso, setNivelAcesso] = useState<NivelAcesso>(usuario.nivelAcesso)
  const [selecionados, setSelecionados] = useState<ModuloChave[]>(() =>
    usuario.modulosLiberados.length === 0
      ? [...TODOS_MODULOS]
      : (usuario.modulosLiberados as ModuloChave[]),
  )
  const [isPending, startTransition] = useTransition()

  function alternarModulo(chave: ModuloChave) {
    setSelecionados((atual) =>
      atual.includes(chave)
        ? atual.filter((item) => item !== chave)
        : [...atual, chave],
    )
  }

  function resetarParaPadrao() {
    setSelecionados(obterModulosDoTemplate(obterTemplatePerfilPadrao(cargo, nivelAcesso)))
  }

  function salvar() {
    startTransition(async () => {
      const result = await atualizarConfiguracaoAcessoUsuario({
        usuarioId: usuario.id,
        cargo,
        nivelAcesso,
        modulos: selecionados,
      })

      if (result?.error) {
        toast.error(result.error)
        return
      }

      toast.success('Permissões atualizadas')
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCargo(usuario.cargo)
          setNivelAcesso(usuario.nivelAcesso)
          setSelecionados(
            usuario.modulosLiberados.length === 0
              ? [...TODOS_MODULOS]
              : (usuario.modulosLiberados as ModuloChave[]),
          )
          setAberto(true)
        }}
        className="rounded-lg bg-[#cce2da]/60 px-3 py-2 text-sm font-bold text-[#006b5a] transition-colors hover:bg-[#cce2da]"
      >
        Editar acessos
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setAberto(false)}>
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#006b5a]">Gestão de Acessos</p>
                <h3 className="mt-1 text-2xl font-bold text-[#171d1c]">{usuario.nome}</h3>
                <p className="mt-1 text-sm text-[#3d4945]/70">
                  {usuario.email} • {usuario.cargoLabel} • nível {usuario.nivelAcesso}
                </p>
                {usuario.modulosLiberados.length === 0 && (
                  <p className="mt-2 text-xs font-semibold text-amber-700">
                    Usuário legado sem módulos salvos: exibindo acesso total para compatibilidade.
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

            <div className="mb-5 grid gap-4 rounded-2xl border border-[#bcc9c4]/30 bg-[#fbfdfd] p-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#6d7a75]">Perfil Operacional</label>
                <select
                  value={cargo}
                  onChange={(event) => setCargo(event.target.value as CargoColaborador)}
                  className="w-full rounded-xl border border-[#bcc9c4]/50 bg-white px-3 py-3 text-sm font-medium text-[#171d1c] focus:border-[#006b5a] focus:outline-none"
                >
                  {OPCOES_CARGO.map((opcao) => (
                    <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#6d7a75]">Nível do Sistema</label>
                <select
                  value={nivelAcesso}
                  onChange={(event) => setNivelAcesso(event.target.value as NivelAcesso)}
                  className="w-full rounded-xl border border-[#bcc9c4]/50 bg-white px-3 py-3 text-sm font-medium text-[#171d1c] focus:border-[#006b5a] focus:outline-none"
                >
                  {OPCOES_NIVEL.map((opcao) => (
                    <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                  ))}
                </select>
                {nivelAcesso === 'master' && (
                  <p className="text-xs font-semibold text-amber-700">
                    Usuários master recebem todos os módulos automaticamente ao salvar.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={resetarParaPadrao}
                  className="rounded-xl border border-[#006b5a]/20 px-4 py-2 text-sm font-bold text-[#006b5a] transition-colors hover:bg-[#f0fcf9]"
                >
                  Aplicar acessos padrão
                </button>
              </div>

              {GRUPOS_MODULOS.map((grupo) => (
                <section key={grupo.chave_grupo} className="rounded-2xl border border-[#bcc9c4]/30 bg-[#fbfdfd] p-4">
                  <div className="mb-3">
                    <h4 className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#3d4945]">{grupo.label}</h4>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {grupo.modulos.map((modulo) => {
                      const checked = selecionados.includes(modulo.chave)

                      return (
                        <label
                          key={modulo.chave}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${
                            checked
                              ? 'border-[#006b5a]/40 bg-[#eaf7f3]'
                              : 'border-[#bcc9c4]/40 bg-white hover:bg-[#f7faf9]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => alternarModulo(modulo.chave)}
                            className="mt-1 h-4 w-4 rounded border-[#bcc9c4] text-[#006b5a] focus:ring-[#006b5a]"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#171d1c]">{modulo.label}</p>
                            <p className="text-xs text-[#3d4945]/65">{modulo.rota}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#bcc9c4]/30 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-xl px-5 py-3 text-sm font-bold text-[#3d4945] transition-colors hover:bg-[#f0f5f4]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={isPending}
                className="rounded-xl bg-gradient-to-r from-[#006b5a] to-[#33a68f] px-5 py-3 text-sm font-bold text-white shadow-md shadow-[#006b5a]/20 transition-opacity hover:opacity-90 disabled:opacity-70"
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
