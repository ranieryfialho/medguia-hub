'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Search, User, Users, Loader2,
  LayoutDashboard, CalendarDays, ClipboardList, CheckCircle,
  MessageSquare, ShoppingBag,
} from 'lucide-react'
import { buscarGlobal, type ResultadoBusca } from '@/actions/busca'
import { temAcesso } from '@/lib/modulos'
import type { ModuloChave } from '@/lib/modulos'

type QuickItem = { chave: ModuloChave; label: string; href: string; Icon: React.ElementType }

const QUICK_ACCESS: QuickItem[] = [
  { chave: 'agenda',             label: 'Agendamentos', href: '/agenda',               Icon: CalendarDays  },
  { chave: 'pacientes',          label: 'Pacientes',    href: '/pacientes',             Icon: User          },
  { chave: 'confirmacoes:cards', label: 'Confirmações', href: '/confirmacoes/cards',    Icon: CheckCircle   },
  { chave: 'prontuarios',        label: 'Prontuários',  href: '/prontuarios',           Icon: ClipboardList },
  { chave: 'contatos:base',      label: 'Contatos',     href: '/contatos',              Icon: MessageSquare },
  { chave: 'comercial:vendas',   label: 'Vendas',       href: '/vendas',                Icon: ShoppingBag   },
  { chave: 'equipe:membros',     label: 'Equipe',       href: '/equipe',                Icon: Users         },
  { chave: 'dashboard',          label: 'Dashboard',    href: '/dashboard',             Icon: LayoutDashboard },
]

export function BuscaGlobal({ modulosLiberados }: { modulosLiberados: string[] }) {
  const [aberto, setAberto] = useState(false)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[]>([])
  const [carregando, setCarregando] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(0)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  const abrir = useCallback(() => {
    setAberto(true)
    setQuery('')
    setResultados([])
    setIndiceAtivo(0)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const fechar = useCallback(() => {
    setAberto(false)
    setQuery('')
    setResultados([])
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        abrir()
      }
    }
    function onAbrirEvent() { abrir() }

    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('busca:abrir', onAbrirEvent)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('busca:abrir', onAbrirEvent)
    }
  }, [abrir])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResultados([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    const timer = setTimeout(async () => {
      const data = await buscarGlobal(query, modulosLiberados)
      setResultados(data)
      setCarregando(false)
      setIndiceAtivo(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, modulosLiberados])

  const linksRapidos = QUICK_ACCESS.filter(item => temAcesso(modulosLiberados, item.chave)).slice(0, 6)
  const buscando = query.trim().length >= 2
  const pacientes = resultados.filter(r => r.tipo === 'paciente')
  const profissionais = resultados.filter(r => r.tipo === 'profissional')

  const itensNavegaveis = buscando
    ? resultados.map(r => r.href)
    : linksRapidos.map(l => l.href)

  function navegar(href: string) {
    fechar()
    router.push(href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const total = itensNavegaveis.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceAtivo(prev => (prev + 1) % total)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceAtivo(prev => (prev - 1 + total) % total)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const href = itensNavegaveis[indiceAtivo]
      if (href) navegar(href)
    } else if (e.key === 'Escape') {
      fechar()
    }
  }

  if (!mounted || !aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center pt-[8vh] px-4"
      onClick={fechar}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <span className="shrink-0 text-[#3d4945]">
            {carregando
              ? <Loader2 size={18} className="animate-spin text-[#006b5a]" />
              : <Search size={18} />
            }
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setIndiceAtivo(0) }}
            onKeyDown={onKeyDown}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Buscar páginas, pacientes, alergias, procedimentos..."
            className="flex-1 bg-transparent text-[#171d1c] text-sm outline-none placeholder:text-[#3d4945]/40"
          />
          <kbd className="shrink-0 text-[10px] font-bold text-[#3d4945]/40 border border-[#dee3e3] rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Body */}
        <div className="max-h-80 overflow-y-auto">
          {/* Acesso rápido */}
          {!buscando && (
            <>
              <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#3d4945]/50">
                Acesso Rápido
              </p>
              {linksRapidos.map((item, idx) => (
                <button
                  key={item.href}
                  type="button"
                  onMouseEnter={() => setIndiceAtivo(idx)}
                  onClick={() => navegar(item.href)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx === indiceAtivo ? 'bg-[#f0f5f4]' : 'hover:bg-[#f0f5f4]'}`}
                >
                  <div className="w-7 h-7 rounded-lg bg-[#f0f5f4] border border-[#dee3e3]/60 flex items-center justify-center shrink-0">
                    <item.Icon size={14} className="text-[#3d4945]" />
                  </div>
                  <span className="text-sm font-medium text-[#171d1c]">{item.label}</span>
                  {idx === indiceAtivo && (
                    <kbd className="ml-auto text-[10px] font-bold text-[#3d4945]/40 border border-[#dee3e3] rounded px-1.5 py-0.5">
                      Enter
                    </kbd>
                  )}
                </button>
              ))}
            </>
          )}

          {/* Sem resultados */}
          {buscando && !carregando && resultados.length === 0 && (
            <p className="px-4 py-8 text-sm text-[#3d4945]/50 font-medium text-center">
              Nenhum resultado para &quot;{query}&quot;
            </p>
          )}

          {/* Pacientes */}
          {buscando && pacientes.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#006b5a]">
                Pacientes
              </p>
              {pacientes.map(r => {
                const idx = resultados.indexOf(r)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onMouseEnter={() => setIndiceAtivo(idx)}
                    onClick={() => navegar(r.href)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx === indiceAtivo ? 'bg-[#f0f5f4]' : 'hover:bg-[#f0f5f4]'}`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#e8f3f0] flex items-center justify-center shrink-0">
                      <User size={14} className="text-[#006b5a]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#171d1c] truncate">{r.nome}</p>
                      {r.detalhe && <p className="text-[11px] text-[#3d4945]/60 truncate">{r.detalhe}</p>}
                    </div>
                    {idx === indiceAtivo && (
                      <kbd className="ml-auto shrink-0 text-[10px] font-bold text-[#3d4945]/40 border border-[#dee3e3] rounded px-1.5 py-0.5">
                        Enter
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Equipe */}
          {buscando && profissionais.length > 0 && (
            <div>
              {pacientes.length > 0 && <div className="mx-4 h-px bg-slate-100" />}
              <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#3d4945]/50">
                Equipe
              </p>
              {profissionais.map(r => {
                const idx = resultados.indexOf(r)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onMouseEnter={() => setIndiceAtivo(idx)}
                    onClick={() => navegar(r.href)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx === indiceAtivo ? 'bg-[#f0f5f4]' : 'hover:bg-[#f0f5f4]'}`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Users size={14} className="text-[#3d4945]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#171d1c] truncate">{r.nome}</p>
                      {r.detalhe && <p className="text-[11px] text-[#3d4945]/60 capitalize truncate">{r.detalhe}</p>}
                    </div>
                    {idx === indiceAtivo && (
                      <kbd className="ml-auto shrink-0 text-[10px] font-bold text-[#3d4945]/40 border border-[#dee3e3] rounded px-1.5 py-0.5">
                        Enter
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-4">
          {[
            { key: '↑↓', label: 'navegar' },
            { key: '↵',  label: 'abrir'   },
            { key: 'esc', label: 'fechar'  },
          ].map(({ key, label }) => (
            <span key={key} className="flex items-center gap-1 text-[10px] font-medium text-[#3d4945]/50">
              <kbd className="border border-[#dee3e3] rounded px-1 py-px font-bold text-[#3d4945]/60">{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}