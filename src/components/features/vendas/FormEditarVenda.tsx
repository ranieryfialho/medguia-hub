'use client'

import { editarVenda } from '@/actions/vendas'
import { useActionState, useEffect, useState, startTransition, useRef, useTransition } from 'react'
import { LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { ComboboxPaciente } from '@/components/features/pacientes'
import { FORMAS_PAGAMENTO } from '@/lib/vendas'
import { createClient } from '@/lib/supabase/client'
import { formatAppDateKey } from '@/lib/datetime'

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
  id?: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  numero_atendimentos: number | null
}

interface VendaInicial {
  id: string
  paciente_id: string
  profissional_id: string | null
  origem: string
  forma_pagamento: string
  protocolo_id?: string | null
  protocolo_nome?: string | null
  medico_referenciador_nome?: string | null
  venda_em_consultorio?: boolean | null
  data_venda: string
  observacoes?: string | null
  status?: string | null
  pacientes?: {
    nome: string
  } | null
}

interface FormEditarVendaProps {
  vendaId: string
  vendaInicial: VendaInicial
  itensInicial: ItemVenda[]
  profissionais: Profissional[]
  produtos: Produto[]
  medicos?: Profissional[]
}

const OPCOES_ORIGEM = [
  { value: 'medico', label: 'Médico' },
  { value: 'leads', label: 'Leads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'campanha', label: 'Campanha' },
]
const USUARIO_AUTORIZADO_VENDA_ZERADA = '46581234-19dd-4e7d-904d-db0357fa2219'

// @spec:AC-061 @spec:AC-062 — venda_em_consultorio só existe (não-null) quando origem é 'medico';
// qualquer outra origem envia null, nunca herda o último valor marcado.
export function resolverVendaEmConsultorioParaEnvio(origem: string, toggleAtivo: boolean): boolean | null {
  return origem === 'medico' ? toggleAtivo : null
}

export function FormEditarVenda({
  vendaId,
  vendaInicial,
  itensInicial,
  profissionais,
  produtos,
  medicos = [],
}: FormEditarVendaProps) {
  const [state, formAction] = useActionState(editarVenda, null)

  // Form state
  const [pacienteId, setPacienteId] = useState(vendaInicial.paciente_id)
  const [pacienteNome, setPacienteNome] = useState(vendaInicial.pacientes?.nome || '')
  const [profissionalId] = useState(vendaInicial.profissional_id)
  const [origem, setOrigem] = useState(vendaInicial.origem)
  const [vendaEmConsultorio, setVendaEmConsultorio] = useState(vendaInicial.venda_em_consultorio ?? false)
  const [formaPagamento, setFormaPagamento] = useState(vendaInicial.forma_pagamento)

  // Encontrar ID do médico baseado no nome
  const medicoInicialId = medicos.find(
    (p) => p.nome === vendaInicial.medico_referenciador_nome
  )?.id || ''

  const [medicoReferenciadorId, setMedicoReferenciadorId] = useState(medicoInicialId)
  const [buscaMedico, setBuscaMedico] = useState('')
  const [dataVenda, setDataVenda] = useState(() => formatAppDateKey(vendaInicial.data_venda))
  const [observacoes, setObservacoes] = useState(vendaInicial.observacoes || '')
  const [statusVenda, setStatusVenda] = useState<'venda_confirmada' | 'orcamento_pendente' | 'orcamento_recusado'>(
    (vendaInicial.status as 'venda_confirmada' | 'orcamento_pendente' | 'orcamento_recusado') ?? 'venda_confirmada'
  )

  const medicosFiltrados = buscaMedico.trim()
    ? medicos.filter((p) => p.nome.toLowerCase().includes(buscaMedico.toLowerCase()))
    : medicos

  const medicoSelecionado = medicos.find((p) => p.id === medicoReferenciadorId)

  // Produtos
  const [itens, setItens] = useState<ItemVenda[]>(itensInicial)
  const [produtoSelecionado, setProdutoSelecionado] = useState('')
  const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1)
  const [precoUnitario, setPrecoUnitario] = useState<number>(0)

  const [showModalConfirmacao, setShowModalConfirmacao] = useState(false)
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('')
  const [senhaError, setSenhaError] = useState('')
  const [erroLocal, setErroLocal] = useState('')
  const [ocultarErroSenhaAction, setOcultarErroSenhaAction] = useState(false)
  const [usuarioAtualId, setUsuarioAtualId] = useState<string | null>(null)
  const [isConfirmandoSenha, startConfirmacaoSenhaTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const calcularTotal = () => {
    return itens.reduce((sum, item) => sum + item.quantidade * item.preco_unitario, 0)
  }
  const total = calcularTotal()

  const adicionarProduto = () => {
    if (!produtoSelecionado || precoUnitario < 0) {
      alert('Selecione um produto e defina um preço válido.')
      return
    }

    const novoItem: ItemVenda = {
      produto_id: produtoSelecionado,
      quantidade: quantidadeSelecionada,
      preco_unitario: precoUnitario,
      numero_atendimentos: produtoAtual?.numero_atendimentos ?? null,
    }

    setItens([...itens, novoItem])
    setProdutoSelecionado('')
    setQuantidadeSelecionada(1)
    setPrecoUnitario(0)
  }

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index))
  }

  const atualizarItem = (index: number, changes: Partial<ItemVenda>) => {
    setItens((current) => current.map((item, i) => (i === index ? { ...item, ...changes } : item)))
  }

  const produtoAtual = produtos.find((p) => p.id === produtoSelecionado)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      setUsuarioAtualId(data.user?.id ?? null)
    })
  }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
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
    startTransition(() => formAction(formData))
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

  const erroSenhaConfirmacao = senhaError || (!ocultarErroSenhaAction && !isConfirmandoSenha ? state?.error : '')
  const isOrcamento = statusVenda !== 'venda_confirmada'

  return (
    <>
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Paciente e Profissional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Paciente</label>
          <ComboboxPaciente
            name="paciente_id"
            tipo="paciente"
            valueMode="id"
            defaultValue={pacienteNome}
            defaultId={pacienteId}
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
          <p className="text-xs text-text-secondary mt-1">
            Digite ao menos 2 letras do nome ou 3 números do CPF.
          </p>
          {pacienteId && pacienteNome && (
            <div className="mt-2 p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
              ✓ <span className="font-medium">{pacienteNome}</span> selecionado
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Profissional</label>
          {profissionalId ? (
            <select
              value={profissionalId}
              disabled
              className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 opacity-50"
            >
              {profissionais
                .filter((p) => p.id === profissionalId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          ) : (
            <div className="px-3 py-2 bg-input border border-border-input rounded-md text-sm text-amber-700 opacity-75">
              Ainda não avaliado
            </div>
          )}
          <p className="text-xs text-text-secondary mt-1">Profissional não pode ser alterado</p>
        </div>
      </div>

      {/* Origem */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-3">{isOrcamento ? 'Origem do Orçamento' : 'Origem da Venda'}</label>
        <div className="space-y-2">
          {OPCOES_ORIGEM.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                value={opt.value}
                checked={origem === opt.value}
                onChange={(e) => {
                  const novaOrigem = e.target.value
                  setOrigem(novaOrigem)
                  if (novaOrigem !== 'medico') setVendaEmConsultorio(false)
                }}
                className="w-4 h-4 text-primary-500 rounded"
              />
              <span className="text-sm text-text-primary">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Médico Referenciador */}
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

      {/* Data e Observações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Forma de Pagamento</label>
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">Selecione a forma de pagamento...</option>
            {FORMAS_PAGAMENTO.map((forma) => (
              <option key={forma.value} value={forma.value}>
                {forma.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">{isOrcamento ? 'Data do Orçamento' : 'Data da Venda'}</label>
          <input
            type="date"
            value={dataVenda}
            onChange={(e) => setDataVenda(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder={isOrcamento ? 'Adicione observações sobre este orçamento...' : 'Adicione observações sobre esta venda...'}
          rows={3}
          className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Status</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'venda_confirmada',   label: 'Venda confirmada',  activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
            { value: 'orcamento_pendente', label: 'Orç. pendente',     activeClass: 'border-amber-500 bg-amber-50 text-amber-700' },
            { value: 'orcamento_recusado', label: 'Orç. recusado',     activeClass: 'border-red-500 bg-red-50 text-red-700' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusVenda(opt.value as typeof statusVenda)}
              className={`p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                statusVenda === opt.value
                  ? opt.activeClass
                  : 'border-border hover:bg-page text-text-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Produtos */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-text-primary">Produtos</h3>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Adicionar Produto</label>
          <select
            value={produtoSelecionado}
            onChange={(e) => {
              const nextProdutoId = e.target.value
              const prod = produtos.find((p) => p.id === nextProdutoId)

              setProdutoSelecionado(nextProdutoId)
              setPrecoUnitario(prod?.preco_padrao ?? 0)
            }}
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">Selecione um produto...</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}{p.numero_atendimentos ? ` (${p.numero_atendimentos} att)` : ''} - R$ {p.preco_padrao.toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        {produtoAtual && (
          <>
            <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium text-text-primary mb-2">Preço Unitário (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoUnitario}
                  onChange={(e) => setPrecoUnitario(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={adicionarProduto}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md font-medium transition-colors"
            >
              <Plus size={16} />
              Adicionar Produto
            </button>
          </>
        )}

        {itens.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-3">{isOrcamento ? 'Produtos no Orçamento' : 'Produtos na Venda'}</h4>
            <div className="space-y-2">
              {itens.map((item, idx) => {
                const prod = produtos.find((p) => p.id === item.produto_id)
                const subtotal = item.quantidade * item.preco_unitario
                const atendimentosLabel = item.numero_atendimentos
                  ? `${item.numero_atendimentos} ${item.numero_atendimentos === 1 ? 'atendimento' : 'atendimentos'}`
                  : null

                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-page border border-border">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{prod?.nome}</p>
                      <p className="text-xs text-text-secondary">
                        {item.quantidade}x R$ {item.preco_unitario.toFixed(2)} = R$ {subtotal.toFixed(2)}
                      </p>
                      {atendimentosLabel && <p className="text-xs text-text-secondary mt-1">{atendimentosLabel} {isOrcamento ? 'neste orçamento' : 'nesta venda'}</p>}
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
                    <button
                      type="button"
                      onClick={() => removerItem(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 p-3 rounded-md bg-primary-50 border border-primary-200">
              <p className="text-sm font-medium text-primary-900">
                Total: R$ {calcularTotal().toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Campos ocultos */}
      <input type="hidden" name="id" value={vendaId} />
      <input type="hidden" name="protocolo_id" value={vendaInicial.protocolo_id ?? ''} />
      <input type="hidden" name="protocolo_nome" value={vendaInicial.protocolo_nome ?? ''} />
      <input type="hidden" name="profissional_id" value={profissionalId ?? ''} />
      <input type="hidden" name="origem" value={origem} />
      <input type="hidden" name="forma_pagamento" value={formaPagamento} />
      <input type="hidden" name="medico_referenciador_id" value={medicoReferenciadorId} />
      <input
        type="hidden"
        name="venda_em_consultorio"
        value={(() => {
          const valor = resolverVendaEmConsultorioParaEnvio(origem, vendaEmConsultorio)
          return valor === null ? '' : String(valor)
        })()}
      />
      <input type="hidden" name="data_venda" value={dataVenda} />
      <input type="hidden" name="observacoes" value={observacoes} />
      <input type="hidden" name="itens_venda_json" value={JSON.stringify(itens)} />
      <input type="hidden" name="status" value={statusVenda} />

      {/* Botões */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={total >= 999999.99}
          title={total >= 999999.99 ? 'Valor máximo é R$ 999.999,99' : ''}
          className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {total >= 999999.99 ? 'Valor muito alto' : 'Salvar Alterações'}
        </button>
      </div>

      {/* Erro */}
      {!showModalConfirmacao && (erroLocal || state?.error) && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
          {erroLocal || state?.error}
        </div>
      )}
    </form>

    {/* Modal de confirmação para valor zero */}
    {showModalConfirmacao && (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">
            {isOrcamento ? 'Confirmar Orçamento com Valor Zero' : 'Confirmar Venda com Valor Zero'}
          </h3>
          <p className="text-sm text-text-secondary">
            {isOrcamento ? 'O orçamento está' : 'A venda está'} com valor total de R$ 0,00. Isso pode ser intencional (brinde, cortesia, etc)?
          </p>
          <p className="text-sm text-text-secondary">
            Digite sua senha para confirmar a alteração com este valor.
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
              Validando senha e salvando alterações...
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
    </>
  )
}
