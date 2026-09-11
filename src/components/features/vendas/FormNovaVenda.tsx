'use client'

import { criarVenda } from '@/actions/vendas'
import { useActionState, useEffect, useState, useRef, useTransition } from 'react'
import { ChevronRight, ChevronLeft, LoaderCircle, Plus, Trash2, Layers } from 'lucide-react'
import { ComboboxPaciente } from '@/components/features/pacientes'
import { UploadComprovantesVenda } from './UploadComprovantesVenda'
import { serializarComprovantes, type ComprovanteVenda } from '@/lib/comprovantes-venda'
import { FormaPagamentoSplit, pagamentosValidosParaEnvio, type PagamentoVendaForm } from './FormaPagamentoSplit'
import { TIPO_VENDA } from '@/lib/vendas'
import { createClient } from '@/lib/supabase/client'
import { formatAppDateKey } from '@/lib/datetime'
import type { Protocolo } from '@/actions/protocolos'

interface Profissional {
  id: string
  nome: string
  role: string
}

interface Produto {
  id: string
  nome: string
  numero_atendimentos?: number
  preco_padrao: number
}

interface ItemVenda {
  produto_id: string
  quantidade: number
  preco_unitario: number
  numero_atendimentos: number | null
}

interface Objecao {
  id: string
  nome: string
}

interface FormNovaVendaProps {
  profissionais: Profissional[]
  produtos: Produto[]
  medicos?: Profissional[]
  protocolos?: Protocolo[]
  objecoes?: Objecao[]
}

const OPCOES_ORIGEM = [
  { value: 'medico', label: 'Médico' },
  { value: 'leads', label: 'Leads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'campanha', label: 'Campanha' },
]

const ROLE_LABEL: Record<string, string> = {
  fisioterapeuta: 'Fisioterapeuta',
  gestor: 'Gestor',
  master: 'Master',
}

// @spec:AC-061 @spec:AC-062 — venda_em_consultorio só existe (não-null) quando origem é 'medico';
// qualquer outra origem envia null, nunca herda o último valor marcado.
export function resolverVendaEmConsultorioParaEnvio(origem: string, toggleAtivo: boolean): boolean | null {
  return origem === 'medico' ? toggleAtivo : null
}

const ABAS = ['Paciente & Profissional', 'Origem da Venda', 'Produtos']
const USUARIO_AUTORIZADO_VENDA_ZERADA = '46581234-19dd-4e7d-904d-db0357fa2219'

export function FormNovaVenda({ profissionais, produtos, medicos = [], protocolos = [], objecoes = [] }: FormNovaVendaProps) {
  const [state, formAction] = useActionState(criarVenda, null)

  const [abaAtual, setAbaAtual] = useState(0)

  // Aba 0
  const [pacienteId, setPacienteId] = useState('')
  const [pacienteNome, setPacienteNome] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [semProfissional, setSemProfissional] = useState(false)
  const [buscaProfissional, setBuscaProfissional] = useState('')

  // Aba 1
  const [origem, setOrigem] = useState('')
  const [vendaEmConsultorio, setVendaEmConsultorio] = useState(false)
  const [medicoReferenciadorId, setMedicoReferenciadorId] = useState('')
  const [buscaMedico, setBuscaMedico] = useState('')
  const [dataVenda, setDataVenda] = useState(() => formatAppDateKey(new Date()))
  const [observacoes, setObservacoes] = useState('')
  const [statusVenda, setStatusVenda] = useState<'venda_confirmada' | 'orcamento_pendente'>('venda_confirmada')
  const [tipoVenda, setTipoVenda] = useState('')
  const [comprovantes, setComprovantes] = useState<ComprovanteVenda[]>([])

  // Aba 2
  const [nome, setNome] = useState('')
  const [protocoloId, setProtocoloId] = useState('')
  const [itens, setItens] = useState<ItemVenda[]>([])
  const [pagamentos, setPagamentos] = useState<PagamentoVendaForm[]>([{ formaPagamento: '', valor: 0, parcelas: 1, valorComJuros: null }])
  const [produtoSelecionado, setProdutoSelecionado] = useState('')
  const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1)
  const [precoUnitario, setPrecoUnitario] = useState<number>(0)
  const [descontoPercent, setDescontoPercent] = useState<number>(0)

  const [showModalConfirmacao, setShowModalConfirmacao] = useState(false)
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('')
  const [senhaError, setSenhaError] = useState('')
  const [erroLocal, setErroLocal] = useState('')
  const [ocultarErroSenhaAction, setOcultarErroSenhaAction] = useState(false)
  const [usuarioAtualId, setUsuarioAtualId] = useState<string | null>(null)

  const [showModalObjecao, setShowModalObjecao] = useState(false)
  const [objecaoMotivoId, setObjecaoMotivoId] = useState('')
  const [objecaoObservacao, setObjecaoObservacao] = useState('')
  const [isSubmitting, startSubmitTransition] = useTransition()
  const [isConfirmandoSenha, startConfirmacaoSenhaTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const calcularTotal = () => itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const total = calcularTotal()

  const profissionaisFiltrados = buscaProfissional.trim()
    ? profissionais.filter((p) =>
        p.nome.toLowerCase().includes(buscaProfissional.toLowerCase())
      )
    : profissionais

  const profissionalSelecionado = profissionais.find((p) => p.id === profissionalId)
  const produtoAtual = produtos.find((p) => p.id === produtoSelecionado)

  const handleDescontoChange = (valor: number) => {
    const desconto = Math.min(100, Math.max(0, valor))
    setDescontoPercent(desconto)
    if (produtoAtual) {
      setPrecoUnitario(parseFloat((produtoAtual.preco_padrao * (1 - desconto / 100)).toFixed(2)))
    }
  }

  const handlePrecoChange = (valor: number) => {
    setPrecoUnitario(valor)
    if (produtoAtual && produtoAtual.preco_padrao > 0) {
      const pct = ((1 - valor / produtoAtual.preco_padrao) * 100)
      setDescontoPercent(parseFloat(Math.max(0, pct).toFixed(1)))
    }
  }

  const podeAvancar0 = !!pacienteId && (!!profissionalId || semProfissional)
  const podeAvancar1 = !!origem && !!tipoVenda && (origem !== 'medico' || !!medicoReferenciadorId)

  const medicosFiltrados = buscaMedico.trim()
    ? medicos.filter((p) => p.nome.toLowerCase().includes(buscaMedico.toLowerCase()))
    : medicos

  const medicoSelecionado = medicos.find((p) => p.id === medicoReferenciadorId)

  const adicionarProduto = () => {
    if (!produtoSelecionado) return
    setItens([
      ...itens,
      {
        produto_id: produtoSelecionado,
        quantidade: quantidadeSelecionada,
        preco_unitario: precoUnitario,
        numero_atendimentos: produtoAtual?.numero_atendimentos ?? null,
      },
    ])
    setProdutoSelecionado('')
    setQuantidadeSelecionada(1)
    setPrecoUnitario(0)
    setDescontoPercent(0)
  }

  const removerItem = (idx: number) => setItens(itens.filter((_, i) => i !== idx))

  const atualizarItem = (idx: number, changes: Partial<ItemVenda>) => {
    setItens((current) => current.map((item, i) => (i === idx ? { ...item, ...changes } : item)))
  }

  const aplicarProtocolo = (id: string) => {
    const protocolo = protocolos.find(p => p.id === id)
    if (!protocolo) return
    const novosItens = protocolo.itens
      .map(item => {
        const prod = produtos.find(p => p.id === item.produto_id)
        if (!prod) return null
        return {
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unitario: prod.preco_padrao,
          numero_atendimentos: prod.numero_atendimentos ?? null,
        }
      })
      .filter((item): item is ItemVenda => item !== null)
    setItens(novosItens)
    setNome(protocolo.nome)
    setProtocoloId(id)
  }

  const protocoloSelecionado = protocolos.find((p) => p.id === protocoloId) ?? null
  const objecaoSelecionada = objecoes.find((o) => o.id === objecaoMotivoId) ?? null

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      setUsuarioAtualId(data.user?.id ?? null)
    })
  }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting || isConfirmandoSenha) return

    if (statusVenda === 'orcamento_pendente') {
      setErroLocal('')
      setShowModalObjecao(true)
      return
    }

    if (comprovantes.length === 0) {
      setErroLocal('Anexe o comprovante de pagamento para confirmar a venda.')
      setOcultarErroSenhaAction(true)
      return
    }

    if (total > 0 && !pagamentosValidosParaEnvio(pagamentos, total, true)) {
      setErroLocal('A soma dos pagamentos precisa ser igual ao total da venda.')
      setOcultarErroSenhaAction(true)
      return
    }

    if (total === 0) {
      if (usuarioAtualId !== USUARIO_AUTORIZADO_VENDA_ZERADA) {
        setErroLocal('Apenas o usuário autorizado pode confirmar venda com valor zero.')
        setOcultarErroSenhaAction(true)
        return
      }

      setErroLocal('')
      setSenhaError('')
      setOcultarErroSenhaAction(true)
      setShowModalConfirmacao(true)
      return
    }

    setErroLocal('')
    const formData = new FormData(e.currentTarget)
    startSubmitTransition(() => formAction(formData))
  }

  const handleConfirmarValorZero = (senha: string) => {
    if (!senha.trim()) {
      setSenhaError('Digite sua senha para confirmar')
      return
    }

    if (!formRef.current) {
      setSenhaError('Não foi possível localizar o formulário.')
      return
    }

    const formData = new FormData(formRef.current)
    formData.set('senha_confirmacao', senha.trim())
    setSenhaError('')
    setOcultarErroSenhaAction(false)
    startConfirmacaoSenhaTransition(() => formAction(formData))
  }

  const handleConfirmarObjecao = () => {
    if (!formRef.current) return

    const formData = new FormData(formRef.current)
    formData.set('objecao_motivo_id', objecaoMotivoId)
    formData.set('objecao_motivo_nome', objecaoSelecionada?.nome ?? '')
    formData.set('objecao_observacao', objecaoObservacao)

    setShowModalObjecao(false)
    setErroLocal('')
    startSubmitTransition(() => formAction(formData))
  }

  const erroSenhaConfirmacao = senhaError || (!ocultarErroSenhaAction && !isConfirmandoSenha ? state?.error : '')
  const isProcessing = isSubmitting || isConfirmandoSenha

  return (
    <>
    <form ref={formRef} onSubmit={handleSubmit} className={`space-y-6 transition-opacity ${isProcessing ? 'opacity-80' : ''}`}>

      {/* Indicador de abas */}
      <div className="flex items-center gap-0">
        {ABAS.map((titulo, idx) => (
          <div key={idx} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => idx < abaAtual && setAbaAtual(idx)}
              disabled={idx > abaAtual}
              className="flex items-center gap-3 group"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shrink-0 ${
                idx === abaAtual
                  ? 'bg-primary-500 text-white ring-4 ring-primary-500/20'
                  : idx < abaAtual
                    ? 'bg-green-500 text-white cursor-pointer'
                    : 'bg-border text-text-secondary cursor-not-allowed'
              }`}>
                {idx < abaAtual ? '✓' : idx + 1}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[10px] text-text-secondary uppercase tracking-wide">Passo {idx + 1}</p>
                <p className={`text-sm font-medium leading-tight ${idx === abaAtual ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {titulo}
                </p>
              </div>
            </button>
            {idx < ABAS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 transition-colors ${idx < abaAtual ? 'bg-green-500' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ─── ABA 0: Paciente & Profissional ─── */}
      {abaAtual === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          {/* Paciente */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-text-primary border-b border-border pb-2">Paciente</h2>

            <ComboboxPaciente
              name="paciente_id"
              tipo="paciente"
              valueMode="id"
              placeholder="Buscar por nome ou CPF..."
              onSelect={(paciente) => {
                setPacienteId(paciente.id)
                setPacienteNome(paciente.nome)
              }}
              onClear={() => {
                setPacienteId('')
                setPacienteNome('')
              }}
            />

            <p className="text-xs text-text-secondary">
              Digite ao menos 2 letras do nome ou 3 números do CPF.
            </p>

            {pacienteId && pacienteNome && (
              <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
                ✓ <span className="font-medium">{pacienteNome}</span> selecionado
              </div>
            )}
          </div>

          {/* Profissional */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-text-primary border-b border-border pb-2">Profissional Responsável</h2>

            <input
              type="text"
              value={buscaProfissional}
              onChange={(e) => { setBuscaProfissional(e.target.value); if (semProfissional) setSemProfissional(false) }}
              placeholder="Buscar por nome..."
              className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />

            <div className="border border-border rounded-md overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                {/* Opção: paciente ainda não avaliado */}
                <button
                  type="button"
                  onClick={() => { setSemProfissional(true); setProfissionalId(''); setBuscaProfissional(''); setStatusVenda('orcamento_pendente') }}
                  className={`w-full px-4 py-3 text-left text-sm border-b border-border transition-colors ${
                    semProfissional
                      ? 'bg-amber-500 text-white'
                      : 'hover:bg-page text-text-secondary'
                  }`}
                >
                  <span className="font-medium">Ainda não avaliado</span>
                  <span className={`ml-2 text-xs ${semProfissional ? 'opacity-80' : 'text-text-secondary'}`}>
                    Somente orçamento
                  </span>
                </button>

                {profissionaisFiltrados.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-text-secondary">Nenhum profissional encontrado.</p>
                ) : (
                  profissionaisFiltrados.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setProfissionalId(p.id); setSemProfissional(false); setBuscaProfissional('') }}
                      className={`w-full px-4 py-3 text-left text-sm border-b border-border last:border-0 transition-colors ${
                        profissionalId === p.id && !semProfissional
                          ? 'bg-primary-500 text-white'
                          : 'hover:bg-page text-text-primary'
                      }`}
                    >
                      <span className="font-medium">{p.nome}</span>
                      <span className={`ml-2 text-xs ${profissionalId === p.id && !semProfissional ? 'opacity-75' : 'text-text-secondary'}`}>
                        {ROLE_LABEL[p.role] || p.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {semProfissional && (
              <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                ✓ Paciente ainda não avaliado — orçamento sem profissional definido
              </div>
            )}
            {profissionalSelecionado && !semProfissional && (
              <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
                ✓ <span className="font-medium">{profissionalSelecionado.nome}</span> selecionado
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ABA 1: Origem ─── */}
      {abaAtual === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-text-primary border-b border-border pb-2">Origem da Venda</h2>

            <div className="space-y-2">
              {OPCOES_ORIGEM.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    origem === opt.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-border hover:bg-page'
                  }`}
                >
                  <input
                    type="radio"
                    value={opt.value}
                    checked={origem === opt.value}
                    onChange={(e) => {
                      const novaOrigem = e.target.value
                      setOrigem(novaOrigem)
                      if (novaOrigem !== 'medico') setVendaEmConsultorio(false)
                    }}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span className={`text-sm font-medium ${origem === opt.value ? 'text-primary-700' : 'text-text-primary'}`}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>

            {origem === 'medico' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">
                  Médico Referenciador *
                </label>

                <input
                  type="text"
                  value={buscaMedico}
                  onChange={(e) => setBuscaMedico(e.target.value)}
                  placeholder={medicoSelecionado ? medicoSelecionado.nome : "Buscar médico..."}
                  className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                />

                {buscaMedico && (
                  <div className="border border-border rounded-md overflow-hidden">
                    <div className="max-h-32 overflow-y-auto">
                      {medicosFiltrados.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-text-secondary">Nenhum médico encontrado.</p>
                      ) : (
                        medicosFiltrados.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => { setMedicoReferenciadorId(m.id); setBuscaMedico('') }}
                            className={`w-full px-3 py-2 text-left text-sm border-b border-border last:border-0 transition-colors ${
                              medicoReferenciadorId === m.id
                                ? 'bg-primary-500 text-white'
                                : 'hover:bg-page text-text-primary'
                            }`}
                          >
                            {m.nome}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {medicoSelecionado && !buscaMedico && (
                  <div className="text-xs text-green-600 font-medium">✓ {medicoSelecionado.nome} selecionado</div>
                )}

                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={vendaEmConsultorio}
                      onClick={() => setVendaEmConsultorio((v) => !v)}
                      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
                        vendaEmConsultorio ? 'bg-primary-500' : 'bg-border'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          vendaEmConsultorio ? 'translate-x-4' : ''
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-text-primary">
                      Venda realizada em consultório médico?
                    </span>
                  </label>
                  <p className="text-xs text-text-secondary mt-1">
                    {vendaEmConsultorio
                      ? 'O médico já fechou a venda diretamente no consultório.'
                      : 'Conversão pelo fisioterapeuta — o médico apenas encaminhou o paciente.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-base font-semibold text-text-primary border-b border-border pb-2">Data e Observações</h2>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Data da Venda</label>
              <input
                type="date"
                value={dataVenda}
                onChange={(e) => setDataVenda(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Observações</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações sobre esta venda..."
                rows={5}
                className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Tipo de Venda *</label>
              <div className="grid grid-cols-2 gap-2">
                {TIPO_VENDA.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTipoVenda(opt.value)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      tipoVenda === opt.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-border hover:bg-page text-text-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Tipo de Registro</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatusVenda('venda_confirmada')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    statusVenda === 'venda_confirmada'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-border hover:bg-page text-text-secondary'
                  }`}
                >
                  Venda direta
                </button>
                <button
                  type="button"
                  onClick={() => setStatusVenda('orcamento_pendente')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    statusVenda === 'orcamento_pendente'
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-border hover:bg-page text-text-secondary'
                  }`}
                >
                  Orçamento
                </button>
              </div>
              <p className="text-xs text-text-secondary mt-1.5">
                {statusVenda === 'orcamento_pendente'
                  ? 'Salvo como orçamento pendente — pode ser confirmado como venda depois.'
                  : 'Venda confirmada imediatamente.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Comprovantes de Pagamento {statusVenda === 'venda_confirmada' && <span className="text-red-500">*</span>}
              </label>
              <UploadComprovantesVenda
                pacienteId={pacienteId}
                pacienteNome={pacienteNome}
                comprovantes={comprovantes}
                onChange={setComprovantes}
              />
              {!pacienteId && comprovantes.length === 0 && (
                <p className="text-xs text-text-secondary mt-1.5">Selecione o paciente na primeira etapa para anexar o comprovante.</p>
              )}
              {pacienteId && statusVenda === 'venda_confirmada' && comprovantes.length === 0 && (
                <p className="text-xs text-red-600 mt-1.5">Obrigatório para confirmar a venda — a venda não será criada sem um comprovante.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── ABA 2: Produtos ─── */}
      {abaAtual === 2 && (
        <div className="space-y-6 pt-4">

          {/* Nome e Protocolo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 rounded-lg bg-page border border-border">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Nome da Venda <span className="text-text-secondary font-normal">(opcional)</span></label>
              <input
                type="text"
                value={nome}
                onChange={e => { setNome(e.target.value); if (!e.target.value) setProtocoloId('') }}
                placeholder="Ex: Artrose+, Protocolo Joelho..."
                className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            {protocolos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  <span className="flex items-center gap-1.5"><Layers size={14} />Aplicar Protocolo</span>
                </label>
                <select
                  value={protocoloId}
                  onChange={e => {
                    if (e.target.value) aplicarProtocolo(e.target.value)
                    else { setProtocoloId(''); setItens([]); setNome('') }
                  }}
                  className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                >
                  <option value="">Selecionar protocolo...</option>
                  {protocolos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-secondary mt-1">Pre-preenche nome e produtos. Itens são editáveis.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Seletor de produto */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-text-primary border-b border-border pb-2">Adicionar Produto</h2>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Produto</label>
              <select
                value={produtoSelecionado}
                onChange={(e) => {
                  const nextProdutoId = e.target.value
                  const prod = produtos.find((p) => p.id === nextProdutoId)

                  setProdutoSelecionado(nextProdutoId)
                  setPrecoUnitario(prod?.preco_padrao ?? 0)
                  setDescontoPercent(0)
                }}
                className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
              >
                <option value="">Selecione um produto...</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}{p.numero_atendimentos ? ` (${p.numero_atendimentos} att)` : ''} — R$ {p.preco_padrao.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {produtoAtual && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      value={quantidadeSelecionada}
                      onChange={(e) => setQuantidadeSelecionada(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Preço (R$)
                      {produtoAtual.preco_padrao > 0 && precoUnitario !== produtoAtual.preco_padrao && (
                        <span className="ml-2 text-xs text-text-secondary line-through">
                          R$ {produtoAtual.preco_padrao.toFixed(2)}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={precoUnitario}
                      onChange={(e) => handlePrecoChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Desconto (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={descontoPercent}
                      onChange={(e) => handleDescontoChange(parseFloat(e.target.value) || 0)}
                      className={`w-full px-3 py-2 bg-input border rounded-md text-sm focus:outline-none transition-colors ${
                        descontoPercent > 0
                          ? 'border-amber-400 text-amber-700 focus:border-amber-500'
                          : 'border-border-input focus:border-primary-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-md bg-page border border-border text-sm text-text-secondary flex items-center justify-between">
                  <span>
                    Subtotal: <span className="font-semibold text-text-primary">R$ {(quantidadeSelecionada * precoUnitario).toFixed(2)}</span>
                  </span>
                  {descontoPercent > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      -{descontoPercent.toFixed(1)}% de desconto
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={adicionarProduto}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-md font-medium transition-colors"
                >
                  <Plus size={16} />
                  Adicionar à Venda
                </button>
              </>
            )}
          </div>

          {/* Lista de itens */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-text-primary border-b border-border pb-2">
              Itens da Venda {itens.length > 0 && <span className="text-text-secondary font-normal">({itens.length})</span>}
            </h2>

            {itens.length === 0 ? (
              <div className="flex items-center justify-center h-40 border-2 border-dashed border-border rounded-lg text-text-secondary text-sm">
                Nenhum produto adicionado
              </div>
            ) : (
              <div className="space-y-2">
                {itens.map((item, idx) => {
                  const prod = produtos.find((p) => p.id === item.produto_id)
                  const descAplicado = prod && prod.preco_padrao > 0
                    ? parseFloat(((1 - item.preco_unitario / prod.preco_padrao) * 100).toFixed(1))
                    : 0
                  const atendimentosLabel = item.numero_atendimentos
                    ? `${item.numero_atendimentos} ${item.numero_atendimentos === 1 ? 'atendimento' : 'atendimentos'}`
                    : null
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-page border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{prod?.nome}</p>
                        <p className="text-xs text-text-secondary flex items-center gap-2">
                          {item.quantidade}× R$ {item.preco_unitario.toFixed(2)}
                          {descAplicado > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                              -{descAplicado}%
                            </span>
                          )}
                        </p>
                        {atendimentosLabel && (
                          <p className="text-xs text-text-secondary mt-1">
                            {atendimentosLabel} nesta venda
                          </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                          <div>
                            <label className="block text-[11px] font-medium text-text-secondary mb-1">
                              Valor unitario
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.preco_unitario}
                              onChange={(e) => atualizarItem(idx, { preco_unitario: parseFloat(e.target.value) || 0 })}
                              className="w-full px-2.5 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-text-secondary mb-1">
                              Atendimentos desta venda
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.numero_atendimentos ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value.trim()
                                atualizarItem(idx, {
                                  numero_atendimentos: raw ? Math.max(1, parseInt(raw, 10) || 1) : null,
                                })
                              }}
                              placeholder="Ex: 10"
                              className="w-full px-2.5 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <span className="text-sm font-semibold text-text-primary whitespace-nowrap">
                          R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removerItem(idx)}
                          className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                <div className="p-4 rounded-lg bg-primary-50 border border-primary-200 flex items-center justify-between">
                  <span className="font-semibold text-primary-900">Total da Venda</span>
                  <span className="text-xl font-bold text-primary-900">R$ {calcularTotal().toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-3 pt-2">
            <h2 className="text-base font-semibold text-text-primary border-b border-border pb-2">Forma de Pagamento</h2>
            <FormaPagamentoSplit pagamentos={pagamentos} onChange={setPagamentos} total={total} />
          </div>
        </div>
      )}

      {/* Campos ocultos */}
      <input type="hidden" name="nome" value={nome} />
      <input type="hidden" name="protocolo_id" value={protocoloId} />
      <input type="hidden" name="protocolo_nome" value={protocoloSelecionado?.nome ?? ''} />
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="profissional_id" value={profissionalId} />
      <input type="hidden" name="origem" value={origem} />
      <input type="hidden" name="medico_referenciador_id" value={medicoReferenciadorId} />
      <input
        type="hidden"
        name="venda_em_consultorio"
        value={(() => {
          const valor = resolverVendaEmConsultorioParaEnvio(origem, vendaEmConsultorio)
          return valor === null ? '' : String(valor)
        })()}
      />
      <input
        type="hidden"
        name="pagamentos_venda_json"
        value={JSON.stringify(pagamentos.map((p) => ({
          forma_pagamento: p.formaPagamento,
          valor: p.valor,
          parcelas: p.parcelas,
          valor_com_juros: p.valorComJuros,
        })))}
      />
      <input type="hidden" name="data_venda" value={dataVenda} />
      <input type="hidden" name="observacoes" value={observacoes} />
      <input type="hidden" name="itens_venda_json" value={JSON.stringify(itens)} />
      <input type="hidden" name="status" value={statusVenda} />
      <input type="hidden" name="tipo_venda" value={tipoVenda} />
      <input
        type="hidden"
        name="comprovantes_pagamento_json"
        value={JSON.stringify(serializarComprovantes(comprovantes))}
      />
      <input type="hidden" name="objecao_motivo_id" value={objecaoMotivoId} />
      <input type="hidden" name="objecao_motivo_nome" value={objecaoSelecionada?.nome ?? ''} />
      <input type="hidden" name="objecao_observacao" value={objecaoObservacao} />

      {/* Navegação */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        <button
          type="button"
          onClick={() => setAbaAtual((a) => Math.max(0, a - 1))}
          disabled={abaAtual === 0 || isProcessing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-page transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
          Voltar
        </button>

        {abaAtual < 2 ? (
          <button
            type="button"
            onClick={() => {
              if (abaAtual === 0 && podeAvancar0) setAbaAtual(1)
              if (abaAtual === 1 && podeAvancar1) setAbaAtual(2)
            }}
            disabled={(abaAtual === 0 && !podeAvancar0) || (abaAtual === 1 && !podeAvancar1) || isProcessing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Próximo
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={
              itens.length === 0 ||
              total >= 999999.99 ||
              (statusVenda === 'venda_confirmada' && comprovantes.length === 0) ||
              isProcessing
            }
            title={
              total >= 999999.99
                ? 'Valor máximo é R$ 999.999,99'
                : statusVenda === 'venda_confirmada' && comprovantes.length === 0
                  ? 'Anexe o comprovante de pagamento para confirmar a venda'
                  : ''
            }
            className="px-6 py-2.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                Criando venda...
              </>
            ) : total >= 999999.99
              ? 'Valor muito alto'
              : statusVenda === 'venda_confirmada' && comprovantes.length === 0
                ? 'Anexe o comprovante para continuar'
                : 'Criar Venda'}
          </button>
        )}
      </div>

      {isSubmitting && (
        <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          <LoaderCircle size={16} className="animate-spin" />
          Salvando venda e preparando redirecionamento...
        </div>
      )}

      {!showModalConfirmacao && !showModalObjecao && (erroLocal || state?.error) && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
          {erroLocal || state?.error}
        </div>
      )}
    </form>

    {/* Modal de confirmação para valor zero */}
    {showModalConfirmacao && (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">Confirmar Venda com Valor Zero</h3>
          <p className="text-sm text-text-secondary">
            A venda está com valor total de R$ 0,00. Isso pode ser intencional (brinde, cortesia, etc)?
          </p>
          <p className="text-sm text-text-secondary">
            Digite sua senha para confirmar a venda com este valor.
          </p>
          <input
            type="password"
            placeholder="Sua senha"
            value={senhaConfirmacao}
            disabled={isConfirmandoSenha}
            onChange={(e) => {
              setSenhaConfirmacao(e.target.value)
              setSenhaError('')
              setOcultarErroSenhaAction(true)
            }}
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 disabled:opacity-60 disabled:cursor-wait"
          />
          {isConfirmandoSenha && (
            <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
              <LoaderCircle size={16} className="animate-spin" />
              Validando senha e finalizando venda...
            </div>
          )}
          {erroSenhaConfirmacao && (
            <div className="p-2 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
              {erroSenhaConfirmacao}
            </div>
          )}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowModalConfirmacao(false); setSenhaConfirmacao(''); setSenhaError('') }}
              disabled={isConfirmandoSenha}
              className="flex-1 px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-page transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleConfirmarValorZero(senhaConfirmacao)}
              disabled={isConfirmandoSenha}
              className="flex-1 px-4 py-2 rounded-md bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-wait inline-flex items-center justify-center gap-2"
            >
              {isConfirmandoSenha && <LoaderCircle size={16} className="animate-spin" />}
              {isConfirmandoSenha ? 'Validando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal de objeção ao criar um orçamento */}
    {showModalObjecao && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-surface rounded-xl border border-border shadow-xl w-full max-w-md p-6 space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">Detalhar objeção (opcional)</h3>
          <p className="text-sm text-text-secondary">
            Este orçamento não foi fechado agora. Se quiser, registre o motivo — isso ajuda a
            entender os principais motivos de objeção nos relatórios.
          </p>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Motivo da objeção</label>
            <select
              value={objecaoMotivoId}
              onChange={(e) => setObjecaoMotivoId(e.target.value)}
              className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Selecionar...</option>
              {objecoes.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Observação</label>
            <textarea
              value={objecaoObservacao}
              onChange={(e) => setObjecaoObservacao(e.target.value)}
              placeholder="Detalhes adicionais sobre a objeção..."
              rows={3}
              className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 resize-none"
            />
          </div>

          {isSubmitting && (
            <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
              <LoaderCircle size={16} className="animate-spin" />
              Criando orçamento...
            </div>
          )}

          {(erroLocal || state?.error) && (
            <div className="p-2 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
              {erroLocal || state?.error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowModalObjecao(false)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md text-sm font-medium text-text-secondary hover:bg-page transition-colors disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleConfirmarObjecao}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-wait inline-flex items-center gap-2"
            >
              {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}
              Criar Orçamento
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
