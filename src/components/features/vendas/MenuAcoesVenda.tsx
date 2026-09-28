'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { MoreHorizontal, Eye, FileText, Edit, Trash2, ExternalLink, Loader2, Receipt, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { ModalTermoVenda, type DadosTermoVenda } from './ModalTermoVenda'
import { ModalReciboVenda } from './ModalReciboVenda'
import { LightboxMidia, type TipoLightboxMidia } from '@/components/features/pacientes/LightboxMidia'
import { FORMA_PAGAMENTO_LABEL } from '@/lib/vendas'
import { deletarVenda } from '@/actions/vendas'
import type { ConfigClinica } from '@/lib/clinica'
import type { ComprovanteVenda } from '@/lib/comprovantes-venda'

function inferirTipoMidia(extensao: string): TipoLightboxMidia {
  const ext = extensao.replace(/^\./, '').toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'file'
}

type Props = {
  vendaId: string
  vendaStatus: string
  nomePaciente: string
  clinica?: ConfigClinica | null
  comprovantes?: ComprovanteVenda[]
}

const DROPDOWN_HEIGHT = 300

export function MenuAcoesVenda({ vendaId, vendaStatus, nomePaciente, clinica, comprovantes = [] }: Props) {
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState<{ top?: number; bottom?: number; left: number }>({ top: 0, left: 0 })
  const [carregando, setCarregando] = useState<'gerar' | 'recibo' | 'visualizar' | null>(null)
  const [dadosTermo, setDadosTermo] = useState<DadosTermoVenda | null>(null)
  const [modalGerarAberto, setModalGerarAberto] = useState(false)
  const [modalReciboAberto, setModalReciboAberto] = useState(false)
  const [comprovanteAberto, setComprovanteAberto] = useState<ComprovanteVenda | null>(null)
  const [documentoAberto, setDocumentoAberto] = useState<{ src: string; nome: string; urlExterna: string | null } | null>(null)
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
        id, forma_pagamento, data_venda, tipo_venda, protocolo_nome, observacoes, medico_referenciador_nome,
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
      tipoVenda: v.tipo_venda ?? null,
      protocoloNome: v.protocolo_nome ?? null,
      medicoReferenciador: v.medico_referenciador_nome ?? null,
      observacoes: v.observacoes ?? null,
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

  const handleGerarRecibo = async () => {
    setAberto(false)
    setCarregando('recibo')
    try {
      const dados = await buscarDadosCompletos()
      if (!dados) { toast.error('Erro ao carregar dados da venda.'); return }
      setModalReciboAberto(true)
    } finally {
      setCarregando(null)
    }
  }

  const handleAbrirDocumento = async (tipo: 'termo' | 'recibo') => {
    setAberto(false)
    setCarregando('visualizar')
    const rotulo = tipo === 'termo' ? 'Contrato' : 'Recibo'
    try {
      const res = await fetch(`/api/drive/verificar-termo?vendaId=${vendaId}&tipo=${tipo}`)
      const json = await res.json()

      if (json.exists && json.fileId) {
        setDocumentoAberto({ src: `/api/drive/file/${json.fileId}`, nome: rotulo, urlExterna: json.fileUrl ?? json.folderUrl ?? null })
      } else {
        toast(`Nenhum ${rotulo.toLowerCase()} salvo para esta venda ainda. Gere um primeiro.`, { icon: 'ℹ️' })
      }
    } catch {
      toast(`Nenhum ${rotulo.toLowerCase()} salvo para esta venda ainda. Gere um primeiro.`, { icon: 'ℹ️' })
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
  const podeGerarDocumentos = vendaStatus === 'venda_confirmada'

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
            {comprovantes.map((comprovante) => (
              <button
                key={comprovante.fileId}
                onClick={() => { setAberto(false); setComprovanteAberto(comprovante) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors"
              >
                <Paperclip size={14} className="text-text-secondary shrink-0" />
                <span className="truncate">{comprovante.nome}</span>
              </button>
            ))}

            <div className="my-1 border-t border-border" />

            <p className="px-3 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
              Contrato{!podeGerarDocumentos && ' (após confirmar a venda)'}
            </p>
            <button
              onClick={handleGerar}
              disabled={!podeGerarDocumentos}
              title={podeGerarDocumentos ? undefined : 'Disponível após a venda ser confirmada'}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <FileText size={14} className="text-primary-500" />
              Gerar Contrato
            </button>
            <button
              onClick={() => handleAbrirDocumento('termo')}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors"
            >
              <ExternalLink size={14} className="text-text-secondary" />
              Abrir Contrato
            </button>

            <div className="my-1 border-t border-border" />

            <p className="px-3 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
              Recibo{!podeGerarDocumentos && ' (após confirmar a venda)'}
            </p>
            <button
              onClick={handleGerarRecibo}
              disabled={!podeGerarDocumentos}
              title={podeGerarDocumentos ? undefined : 'Disponível após a venda ser confirmada'}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Receipt size={14} className="text-primary-500" />
              Gerar Recibo
            </button>
            <button
              onClick={() => handleAbrirDocumento('recibo')}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-page transition-colors"
            >
              <ExternalLink size={14} className="text-text-secondary" />
              Abrir Recibo
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

      {modalReciboAberto && dadosTermo && (
        <ModalReciboVenda
          dados={{
            vendaId: dadosTermo.vendaId,
            paciente: {
              id: dadosTermo.paciente.id,
              nome: dadosTermo.paciente.nome,
              cpf: dadosTermo.paciente.cpf,
              rg: dadosTermo.paciente.rg,
              orgao_emissor_rg: dadosTermo.paciente.orgao_emissor_rg,
              endereco: dadosTermo.paciente.endereco,
              complemento: dadosTermo.paciente.complemento,
            },
            profissional: dadosTermo.profissional,
            forma_pagamento: dadosTermo.forma_pagamento,
            data_venda: dadosTermo.data_venda,
            itens: dadosTermo.itens,
            total: dadosTermo.total,
            tipoVenda: dadosTermo.tipoVenda,
            protocoloNome: dadosTermo.protocoloNome,
            medicoReferenciador: dadosTermo.medicoReferenciador,
            observacoes: dadosTermo.observacoes,
            clinica,
          }}
          forceOpen
          onClose={() => setModalReciboAberto(false)}
        />
      )}

      {comprovanteAberto && (
        <LightboxMidia
          item={{
            src: `/api/drive/file/${comprovanteAberto.fileId}`,
            nome: comprovanteAberto.nome,
            tipo: inferirTipoMidia(comprovanteAberto.extensao),
            urlExterna: comprovanteAberto.fileUrl,
          }}
          onClose={() => setComprovanteAberto(null)}
        />
      )}

      {documentoAberto && (
        <LightboxMidia
          item={{
            src: documentoAberto.src,
            nome: documentoAberto.nome,
            tipo: 'pdf',
            urlExterna: documentoAberto.urlExterna,
            permitirImprimir: true,
          }}
          onClose={() => setDocumentoAberto(null)}
        />
      )}
    </>
  )
}