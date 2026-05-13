'use client'

import { criarProduto } from '@/actions/produtos'
import { useActionState } from 'react'

export function FormNovoProduto() {
  const [state, formAction] = useActionState(criarProduto, null)

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Nome do Produto *</label>
        <input
          type="text"
          name="nome"
          required
          placeholder="Ex: PLAT 10 ATT"
          className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
        />
        <p className="text-xs text-text-secondary mt-1">O nome deve ser único</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Número de Atendimentos</label>
          <input
            type="number"
            name="numero_atendimentos"
            min="1"
            placeholder="Ex: 10"
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          />
          <p className="text-xs text-text-secondary mt-1">Opcional</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Preço Padrão (R$) *</label>
          <input
            type="number"
            name="preco_padrao"
            required
            step="0.01"
            min="0"
            placeholder="0.00"
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Categoria</label>
        <select
          name="categoria"
          className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
        >
          <option value="">Sem categoria</option>
          <option value="tratamento">Tratamento</option>
          <option value="consulta">Consulta</option>
        </select>
        <p className="text-xs text-text-secondary mt-1">Usado para separar faturamento no relatório de vendas</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Descrição</label>
        <textarea
          name="descricao"
          rows={3}
          placeholder="Descreva o produto..."
          className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
        />
      </div>

      <div className="flex items-center justify-end gap-4 pt-6 border-t border-border">
        <button
          type="submit"
          className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md font-medium transition-colors"
        >
          Criar Produto
        </button>
      </div>

      {state?.error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
          {state.error}
        </div>
      )}
    </form>
  )
}
