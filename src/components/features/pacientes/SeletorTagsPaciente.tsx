'use client'

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Tag as TagIcon, Check, Settings } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { adicionarTagAoPaciente, removerTagDoPaciente, type PacienteTag } from '@/actions/paciente-tags'
import { getTagCorConfig } from '@/lib/paciente-tags-cores'

type Props = {
  pacienteId: string
  tagsAtuais: PacienteTag[]
  catalogo: PacienteTag[]
  size?: 'sm' | 'md'
}

const LARGURA_MENU = 224 // w-56

export function SeletorTagsPaciente({ pacienteId, tagsAtuais, catalogo, size = 'sm' }: Props) {
  const [tags, setTags] = useState(tagsAtuais)
  const [tagsAtuaisAnterior, setTagsAtuaisAnterior] = useState(tagsAtuais)
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState({ top: 0, left: 0 })
  const [isPending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  if (tagsAtuais !== tagsAtuaisAnterior) {
    setTagsAtuaisAnterior(tagsAtuais)
    setTags(tagsAtuais)
  }

  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return

    function reposicionar() {
      const rect = botaoRef.current!.getBoundingClientRect()
      const espacoDireita = window.innerWidth - rect.left
      const left = espacoDireita < LARGURA_MENU
        ? Math.max(8, rect.right - LARGURA_MENU)
        : rect.left
      setPosicao({ top: rect.bottom + 6, left })
    }

    reposicionar()
    window.addEventListener('scroll', reposicionar, true)
    window.addEventListener('resize', reposicionar)
    return () => {
      window.removeEventListener('scroll', reposicionar, true)
      window.removeEventListener('resize', reposicionar)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    function handleClickOutside(e: MouseEvent) {
      const alvo = e.target as Node
      if (
        containerRef.current && !containerRef.current.contains(alvo) &&
        menuRef.current && !menuRef.current.contains(alvo)
      ) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [aberto])

  const idsAtuais = new Set(tags.map(t => t.id))

  function toggle(tag: PacienteTag) {
    const jaTem = idsAtuais.has(tag.id)
    setTags(prev => jaTem ? prev.filter(t => t.id !== tag.id) : [...prev, tag])

    startTransition(async () => {
      const res = jaTem
        ? await removerTagDoPaciente(pacienteId, tag.id)
        : await adicionarTagAoPaciente(pacienteId, tag.id)
      if (res.error) {
        toast.error(res.error)
        setTags(prev => jaTem ? [...prev, tag] : prev.filter(t => t.id !== tag.id))
      }
    })
  }

  const chipPad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'

  return (
    <div ref={containerRef} className="relative inline-flex flex-wrap items-center gap-1.5">
      {tags.map(tag => {
        const cfg = getTagCorConfig(tag.cor)
        return (
          <span
            key={tag.id}
            className={`inline-flex items-center gap-1 rounded-full font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} ${chipPad}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {tag.nome}
          </span>
        )
      })}

      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto(v => !v)}
        disabled={isPending}
        title="Gerenciar tags"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-[#006b5a] hover:border-[#006b5a] transition-colors disabled:opacity-50"
      >
        <Plus size={11} />
      </button>

      {aberto && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: posicao.top, left: posicao.left, width: LARGURA_MENU }}
          className="z-[9999] bg-white border border-slate-200 rounded-xl shadow-lg py-1.5"
        >
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <TagIcon size={11} /> Tags do paciente
            </span>
            <Link
              href="/pacientes/tags"
              className="text-slate-300 hover:text-[#006b5a] transition-colors"
              title="Gerenciar catálogo de tags"
            >
              <Settings size={12} />
            </Link>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {catalogo.length === 0 && (
              <p className="px-3 py-3 text-xs text-slate-400">
                Nenhuma tag cadastrada.{' '}
                <Link href="/pacientes/tags" className="text-[#006b5a] font-semibold hover:underline">
                  Criar tag
                </Link>
              </p>
            )}
            {catalogo.map(tag => {
              const cfg = getTagCorConfig(tag.cor)
              const marcado = idsAtuais.has(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggle(tag)}
                  disabled={isPending}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className="flex-1 text-xs font-medium text-slate-700 truncate">{tag.nome}</span>
                  {marcado && <Check size={13} className="text-[#006b5a] shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
