'use client'

import { criarVenda } from '@/actions/vendas'
import { useActionState, useState, startTransition, useRef, useTransition } from 'react'
import { ChevronRight, ChevronLeft, LoaderCircle, Plus, Trash2 } from 'lucide-react'

interface Paciente {
  id: string
  nome: string
  cpf?: string
  telefone?: string
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
  produto_id: string
  quantidade: number
  preco_unitario: number
}

interface FormNovaVendaProps {
  pacientes: Paciente[]
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

const ROLE_LABEL: Record<string, string> = {
  fisioterapeuta: 'Fisioterapeuta',
  gestor: 'Gestor',
  master: 'Master',
}

const ABAS = ['Paciente & Profissional', 'Origem da Venda', 'Produtos']

export function FormNovaVenda({ pacientes, profissionais, produtos, medicos = [] }: FormNovaVendaProps) {
  const [state, formAction] = useActionState(criarVenda, null)

  const [abaAtual, setAbaAtual] = useState(0)

  // Aba 0
  const [pacienteId, setPacienteId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [buscaProfissional, setBuscaProfissional] = useState('')

  // Aba 1
  const [origem, setOrigem] = useState('')
  const [medicoReferenciadorId, setMedicoReferenciadorId] = useState('')
  const [buscaMedico, setBuscaMedico] = useState('')
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')

  // Aba 2
  const [itens, setItens] = useState<ItemVenda[]>([])
  const [produtoSelecionado, setProdutoSelecionado] = useState('')
  const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1)
  const [precoUnitario, setPrecoUnitario] = useState<number>(0)
  const [descontoPercent, setDescontoPercent] = useState<number>(0)

  const [showModalConfirmacao, setShowModalConfirmacao] = useState(false)
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('')
  const [senhaError, setSenhaError] = useState('')
  const [ocultarErroSenhaAction, setOcultarErroSenhaAction] = useState(false)
  const [isConfirmandoSenha, startConfirmacaoSenhaTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const calcularTotal = () => itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const total = calcularTotal()

  const pacientesFiltrados = buscaPaciente.trim()
    ? pacientes.filter(
        (p) =>
          p.nome.toLowerCase().includes(buscaPaciente.toLowerCase()) ||
          p.cpf?.includes(buscaPaciente)
      )
    : pacientes

  const profissionaisFiltrados = buscaProfissional.trim()
    ? profissionais.filter((p) =>
        p.nome.toLowerCase().includes(buscaProfissional.toLowerCase())
      )
    : profissionais

  const pacienteSelecionado = pacientes.find((p) => p.id === pacienteId)
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

  const podeAvancar0 = !!pacienteId && !!profissionalId
  const podeAvancar1 = !!origem && (origem !== 'medico' || !!medicoReferenciadorId)

  const medicosFiltrados = buscaMedico.trim()
    ? medicos.filter((p) => p.nome.toLowerCase().includes(buscaMedico.toLowerCase()))
    : medicos

  const medicoSelecionado = medicos.find((p) => p.id === medicoReferenciadorId)

  const adicionarProduto = () => {
    if (!produtoSelecionado) return
    setItens([...itens, { produto_id: produtoSelecionado, quantidade: quantidadeSelecionada, preco_unitario: precoUnitario }])
    setProdutoSelecionado('')
    setQuantidadeSelecionada(1)
    setPrecoUnitario(0)
    setDescontoPercent(0)
  }

  const removerItem = (idx: number) => setItens(itens.filter((_, i) => i !== idx))

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (total === 0) {
      setShowModalConfirmacao(true)
      return
    }

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

  return (
    <>
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">

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

            <input
              type="text"
              value={buscaPaciente}
              onChange={(e) => setBuscaPaciente(e.target.value)}
              placeholder="Buscar por nome ou CPF..."
              className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />

            <div className="border border-border rounded-md overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                {pacientesFiltrados.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-text-secondary">Nenhum paciente encontrado.</p>
                ) : (
                  pacientesFiltrados.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setPacienteId(p.id); setBuscaPaciente('') }}
                      className={`w-full px-4 py-3 text-left text-sm border-b border-border last:border-0 transition-colors ${
                        pacienteId === p.id
                          ? 'bg-primary-500 text-white'
                          : 'hover:bg-page text-text-primary'
                      }`}
                    >
                      <span className="font-medium">{p.nome}</span>
                      {p.cpf && <span className={`ml-2 text-xs ${pacienteId === p.id ? 'opacity-75' : 'text-text-secondary'}`}>{p.cpf}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>

            {pacienteSelecionado && (
              <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
                ✓ <span className="font-medium">{pacienteSelecionado.nome}</span> selecionado
              </div>
            )}
          </div>

          {/* Profissional */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-text-primary border-b border-border pb-2">Profissional Responsável</h2>

            <input
              type="text"
              value={buscaProfissional}
              onChange={(e) => setBuscaProfissional(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />

            <div className="border border-border rounded-md overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                {profissionaisFiltrados.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-text-secondary">Nenhum profissional encontrado.</p>
                ) : (
                  profissionaisFiltrados.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setProfissionalId(p.id); setBuscaProfissional('') }}
                      className={`w-full px-4 py-3 text-left text-sm border-b border-border last:border-0 transition-colors ${
                        profissionalId === p.id
                          ? 'bg-primary-500 text-white'
                          : 'hover:bg-page text-text-primary'
                      }`}
                    >
                      <span className="font-medium">{p.nome}</span>
                      <span className={`ml-2 text-xs ${profissionalId === p.id ? 'opacity-75' : 'text-text-secondary'}`}>
                        {ROLE_LABEL[p.role] || p.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {profissionalSelecionado && (
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
                    onChange={(e) => setOrigem(e.target.value)}
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
          </div>
        </div>
      )}

      {/* ─── ABA 2: Produtos ─── */}
      {abaAtual === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
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
      )}

      {/* Campos ocultos */}
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="profissional_id" value={profissionalId} />
      <input type="hidden" name="origem" value={origem} />
      <input type="hidden" name="medico_referenciador_id" value={medicoReferenciadorId} />
      <input type="hidden" name="data_venda" value={dataVenda} />
      <input type="hidden" name="observacoes" value={observacoes} />
      <input type="hidden" name="itens_venda_json" value={JSON.stringify(itens)} />

      {/* Navegação */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        <button
          type="button"
          onClick={() => setAbaAtual((a) => Math.max(0, a - 1))}
          disabled={abaAtual === 0}
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
            disabled={(abaAtual === 0 && !podeAvancar0) || (abaAtual === 1 && !podeAvancar1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Próximo
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={itens.length === 0 || total >= 999999.99}
            title={total >= 999999.99 ? 'Valor máximo é R$ 999.999,99' : ''}
            className="px-6 py-2.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {total >= 999999.99 ? 'Valor muito alto' : 'Criar Venda'}
          </button>
        )}
      </div>

      {!showModalConfirmacao && state?.error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
          {state.error}
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
    </>
  )
}
