'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { MoreHorizontal, Eye, FileText, Printer, Edit, Trash2, ExternalLink, Loader2, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { ModalTermoVenda, type DadosTermoVenda } from './ModalTermoVenda'
import { FORMA_PAGAMENTO_LABEL } from '@/lib/vendas'
import { deletarVenda } from '@/actions/vendas'
import type { ConfigClinica } from '@/lib/clinica'

type Props = {
  vendaId: string
  vendaStatus: string
  nomePaciente: string
  clinica?: ConfigClinica | null
}

const DROPDOWN_HEIGHT = 300

export function MenuAcoesVenda({ vendaId, vendaStatus, nomePaciente, clinica }: Props) {
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState<{ top?: number; bottom?: number; left: number }>({ top: 0, left: 0 })
  const [carregando, setCarregando] = useState<'gerar' | 'imprimir' | 'recibo' | 'visualizar' | null>(null)
  const [dadosTermo, setDadosTermo] = useState<DadosTermoVenda | null>(null)
  const [modalGerarAberto, setModalGerarAberto] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const handler = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aberto])

  const buscarDadosCompletos = async (): Promise<DadosTermoVenda | null> => {
    if (dadosTermo) return dadosTermo

    const supabase = createClient()

    const { data: venda } = await supabase
      .from('vendas')
      .select(`
        id, forma_pagamento, data_venda,
        pacientes(id, nome, cpf, rg, orgao_emissor_rg, data_nascimento, telefone, email, endereco, complemento),
        profiles:profissional_id(full_name)
      `)
      .eq('id', vendaId)
      .single()

    const { data: itens } = await supabase
      .from('itens_venda')
      .select('quantidade, preco_unitario, produtos(nome)')
      .eq('venda_id', vendaId)

    if (!venda) return null

    const v = venda as any
    const p = v.pacientes ?? {}
    const itensFormatados = (itens ?? []).map((item: any) => ({
      nome: item.produtos?.nome ?? '',
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      subtotal: item.quantidade * item.preco_unitario,
    }))

    const dados: DadosTermoVenda = {
      vendaId,
      clinica,
      paciente: {
        id: p.id ?? '',
        nome: p.nome ?? nomePaciente,
        cpf: p.cpf ?? null,
        rg: p.rg ?? null,
        orgao_emissor_rg: p.orgao_emissor_rg ?? null,
        data_nascimento: p.data_nascimento ?? null,
        telefone: p.telefone ?? null,
        email: p.email ?? null,
        endereco: p.endereco ?? null,
        complemento: p.complemento ?? null,
      },
      profissional: v.profiles?.full_name ?? null,
      forma_pagamento: FORMA_PAGAMENTO_LABEL[v.forma_pagamento] || v.forma_pagamento,
      data_venda: v.data_venda,
      itens: itensFormatados,
      total: itensFormatados.reduce((s: number, i: any) => s + i.subtotal, 0),
    }

    setDadosTermo(dados)
    return dados
  }

  const handleGerar = async () => {
    setAberto(false)
    setCarregando('gerar')
    try {
      const dados = await buscarDadosCompletos()
      if (!dados) { toast.error('Erro ao carregar dados da venda.'); return }
      setModalGerarAberto(true)
    } finally {
      setCarregando(null)
    }
  }

  const handleImprimir = async () => {
    setAberto(false)
    setCarregando('imprimir')
    try {
      const dados = await buscarDadosCompletos()
      if (!dados) { toast.error('Erro ao carregar dados da venda.'); return }

      const { gerarPdfTermoVenda } = await import('@/lib/relatorios/pdf-termo-venda')
      const blob = await gerarPdfTermoVenda({
        paciente: dados.paciente,
        profissional: dados.profissional,
        forma_pagamento: dados.forma_pagamento,
        data_venda: dados.data_venda,
        itens: dados.itens,
        total: dados.total,
        clinica,
      })

      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      if (w) setTimeout(() => w.print(), 800)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      toast.error('Erro ao gerar o termo para impressão.')
    } finally {
      setCarregando(null)
    }
  }

  const handleImprimirRecibo = async () => {
    setAberto(false)
    setCarregando('recibo')
    try {
      const dados = await buscarDadosCompletos()
      if (!dados) { toast.error('Erro ao carregar dados da venda.'); return }

      const { gerarPdfReciboVenda } = await import('@/lib/relatorios/pdf-recibo-venda')
      const blob = await gerarPdfReciboVenda({
        vendaId: dados.vendaId,
        paciente: { nome: dados.paciente.nome, cpf: dados.paciente.cpf },
        profissional: dados.profissional,
        forma_pagamento: dados.forma_pagamento,
        data_venda: dados.data_venda,
        itens: dados.itens,
        total: dados.total,
        clinica,
      })

      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      if (w) setTimeout(() => w.print(), 800)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      toast.error('Erro ao gerar o recibo.')
    } finally {
      setCarregando(null)
    }
  }

  const handleVisualizar = async () => {
    setAberto(false)
    setCarregando('visualizar')
    try {
      const res = await fetch(`/api/drive/verificar-termo?vendaId=${vendaId}`)
      const json = await res.json()

      if (json.exists) {
        window.open(json.fileUrl ?? json.folderUrl, '_blank')
      } else {
        toast('Nenhum termo salvo para esta venda. Use "Gerar Termo" primeiro.', { icon: 'ℹ️' })
      }
    } catch {
      toast('Nenhum termo salvo para esta venda. Use "Gerar Termo" primeiro.', { icon: 'ℹ️' })
    } finally {
      setCarregando(null)
    }
  }

  const handleExcluir = async () => {
    if (!confirmandoExclusao) {
      setConfirmandoExclusao(true)
      setAberto(false)
      return
    }
    setConfirmandoExclusao(false)
    await deletarVenda(vendaId)
  }

  const isLoading = carregando !== null

  return (
    <>
      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-xl border border-border shadow-xl p-6 max-w-sm w-full space-y-4">
            <p className="font-semibold text-text-primary">Excluir venda?</p>
            <p className="text-sm text-text-secondary">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmandoExclusao(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-text-primary hover:bg-page transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluir}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <button
          ref={btnRef}
          onClick={() => {
            if (aberto) { setAberto(false); return }
            const rect = btnRef.current?.getBoundingClientRect()
            if (rect) {
              const espacoAbaixo = window.innerHeight - rect.bottom
              const left = rect.right - 220
              if (espacoAbaixo < DROPDOWN_HEIGHT) {
                setPosicao({ bottom: window.innerHeight - rect.top + 4, left })
              } else {
                setPosicao({ top: rect.bottom + 4, left })
              }
            }
            setAberto(true)
          }}
          disabled={isLoading}
          className="p-2 rounded-lg hover:bg-page text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
          title="Ações"
        >
          {isLoading
            ? <Loader2 size={16} className="animate-spin" />
            : <MoreHorizontal size={16} />
          }
        </button>

        {aberto && typeof window !== 'undefined' && createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              ...(posicao.bottom !== undefined
                ? { bottom: posicao.bottom }
                : { top: posicao.top }),
              left: posicao.left,
              zIndex: 9999,
            }}
            className="w-56 bg-surface border border-border rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
          >
            <p className="px-3 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
              Venda
            </p>
            <Link
              href={`/vendas/${vendaId}`}
              onClick={() => setAberto(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors"
            >
              <Eye size={14} className="text-text-secondary" />
              Ver detalhes
            </Link>
            <Link
              href={`/vendas/${vendaId}/editar`}
              onClick={() => setAberto(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors"
            >
              <Edit size={14} className="text-text-secondary" />
              Editar
            </Link>
            <button
              onClick={handleImprimirRecibo}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors"
            >
              <Receipt size={14} className="text-text-secondary" />
              Recibo de Contratação
            </button>

            <div className="my-1 border-t border-border" />

            <p className="px-3 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
              Termo
            </p>
            <button
              onClick={handleGerar}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors"
            >
              <FileText size={14} className="text-primary-500" />
              Gerar Termo
            </button>
            <button
              onClick={handleVisualizar}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors"
            >
              <ExternalLink size={14} className="text-text-secondary" />
              Visualizar no Drive
            </button>
            <button
              onClick={handleImprimir}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors"
            >
              <Printer size={14} className="text-text-secondary" />
              Imprimir Termo
            </button>

            <div className="my-1 border-t border-border" />

            <button
              onClick={handleExcluir}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              Excluir
            </button>
          </div>,
          document.body,
        )}
      </div>

      {modalGerarAberto && dadosTermo && (
        <ModalTermoVenda
          dados={dadosTermo}
          forceOpen
          onClose={() => setModalGerarAberto(false)}
        />
      )}
    </>
  )
}