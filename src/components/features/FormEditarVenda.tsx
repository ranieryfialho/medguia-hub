'use client'

import { editarVenda } from '@/actions/vendas'
import { useActionState, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Paciente {
  id: string
  nome: string
}

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
}

interface VendaInicial {
  id: string
  paciente_id: string
  profissional_id: string
  origem: string
  medico_referenciador_nome?: string
  data_venda: string
  observacoes?: string
}

interface FormEditarVendaProps {
  vendaId: string
  vendaInicial: VendaInicial
  itensInicial: ItemVenda[]
  pacientes: Paciente[]
  profissionais: Profissional[]
  produtos: Produto[]
}

const OPCOES_ORIGEM = [
  { value: 'medico', label: 'Médico' },
  { value: 'leads', label: 'Leads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'campanha', label: 'Campanha' },
]

export function FormEditarVenda({
  vendaId,
  vendaInicial,
  itensInicial,
  pacientes,
  profissionais,
  produtos,
}: FormEditarVendaProps) {
  const [state, formAction] = useActionState(editarVenda, null)

  const [showError, setShowError] = useState(false)

  // Form state
  const [pacienteId, setPacienteId] = useState(vendaInicial.paciente_id)
  const [profissionalId, setProfissionalId] = useState(vendaInicial.profissional_id)
  const [origem, setOrigem] = useState(vendaInicial.origem)
  const [medicoReferenciador, setMedicoReferenciador] = useState(vendaInicial.medico_referenciador_nome || '')
  const [dataVenda, setDataVenda] = useState(vendaInicial.data_venda)
  const [observacoes, setObservacoes] = useState(vendaInicial.observacoes || '')

  // Produtos
  const [itens, setItens] = useState<ItemVenda[]>(itensInicial)
  const [produtoSelecionado, setProdutoSelecionado] = useState('')
  const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1)
  const [precoUnitario, setPrecoUnitario] = useState<number>(0)

  // Feedback
  useEffect(() => {
    if (state?.error) {
      setShowError(true)
      const timer = setTimeout(() => setShowError(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [state?.error])

  // Atualizar preço quando produto muda
  useEffect(() => {
    if (produtoSelecionado) {
      const prod = produtos.find((p) => p.id === produtoSelecionado)
      if (prod) {
        setPrecoUnitario(prod.preco_padrao)
      }
    }
  }, [produtoSelecionado, produtos])

  const adicionarProduto = () => {
    if (!produtoSelecionado || precoUnitario < 0) {
      alert('Selecione um produto e defina um preço válido.')
      return
    }

    const novoItem: ItemVenda = {
      produto_id: produtoSelecionado,
      quantidade: quantidadeSelecionada,
      preco_unitario: precoUnitario,
    }

    setItens([...itens, novoItem])
    setProdutoSelecionado('')
    setQuantidadeSelecionada(1)
    setPrecoUnitario(0)
  }

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index))
  }

  const calcularTotal = () => {
    return itens.reduce((sum, item) => sum + item.quantidade * item.preco_unitario, 0)
  }

  const produtoAtual = produtos.find((p) => p.id === produtoSelecionado)

  return (
    <form action={formAction} className="space-y-6">
      {/* Paciente e Profissional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Paciente</label>
          <select
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">Selecione um paciente...</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Profissional</label>
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
          <p className="text-xs text-text-secondary mt-1">Profissional não pode ser alterado</p>
        </div>
      </div>

      {/* Origem */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-3">Origem da Venda</label>
        <div className="space-y-2">
          {OPCOES_ORIGEM.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                value={opt.value}
                checked={origem === opt.value}
                onChange={(e) => setOrigem(e.target.value)}
                className="w-4 h-4 text-primary-500 rounded"
              />
              <span className="text-sm text-text-primary">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Médico Referenciador */}
      {origem === 'medico' && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Nome do Médico Referenciador</label>
          <input
            type="text"
            value={medicoReferenciador}
            onChange={(e) => setMedicoReferenciador(e.target.value)}
            placeholder="Ex: Dr. João Silva"
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          />
        </div>
      )}

      {/* Data e Observações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Data da Venda</label>
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
          placeholder="Adicione observações sobre esta venda..."
          rows={3}
          className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
        />
      </div>

      {/* Produtos */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-text-primary">Produtos</h3>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Adicionar Produto</label>
          <select
            value={produtoSelecionado}
            onChange={(e) => setProdutoSelecionado(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">Selecione um produto...</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} - R$ {p.preco_padrao.toFixed(2)}
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
            <h4 className="text-sm font-medium text-text-primary mb-3">Produtos na Venda</h4>
            <div className="space-y-2">
              {itens.map((item, idx) => {
                const prod = produtos.find((p) => p.id === item.produto_id)
                const subtotal = item.quantidade * item.preco_unitario

                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-page border border-border">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{prod?.nome}</p>
                      <p className="text-xs text-text-secondary">
                        {item.quantidade}x R$ {item.preco_unitario.toFixed(2)} = R$ {subtotal.toFixed(2)}
                      </p>
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
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="profissional_id" value={profissionalId} />
      <input type="hidden" name="origem" value={origem} />
      <input type="hidden" name="medico_referenciador_nome" value={medicoReferenciador} />
      <input type="hidden" name="data_venda" value={dataVenda} />
      <input type="hidden" name="observacoes" value={observacoes} />
      <input type="hidden" name="itens_venda_json" value={JSON.stringify(itens)} />

      {/* Botões */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-border">
        <button
          type="submit"
          className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md font-medium transition-colors"
        >
          Salvar Alterações
        </button>
      </div>

      {/* Erro */}
      {showError && state?.error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
          {state.error}
        </div>
      )}
    </form>
  )
}