'use client'

import { editarProduto } from '@/actions/produtos'
import { useActionState, useEffect, useState } from 'react'

interface ProdutoInicial {
  id: string
  nome: string
  numero_atendimentos?: number
  preco_padrao: number
  descricao?: string
  ativo: boolean
}

export function FormEditarProduto({ produtoInicial }: { produtoInicial: ProdutoInicial }) {
  const [state, formAction] = useActionState(editarProduto, null)
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    if (state?.error) {
      setShowError(true)
      const timer = setTimeout(() => setShowError(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [state?.error])

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Nome do Produto *</label>
        <input
          type="text"
          name="nome"
          required
          defaultValue={produtoInicial.nome}
          className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Número de Atendimentos</label>
          <input
            type="number"
            name="numero_atendimentos"
            min="1"
            defaultValue={produtoInicial.numero_atendimentos || ''}
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Preço Padrão (R$) *</label>
          <input
            type="number"
            name="preco_padrao"
            required
            step="0.01"
            min="0"
            defaultValue={produtoInicial.preco_padrao}
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Descrição</label>
        <textarea
          name="descricao"
          rows={3}
          defaultValue={produtoInicial.descricao || ''}
          className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="hidden"
            name="ativo"
            value={produtoInicial.ativo ? 'true' : 'false'}
          />
          <input
            type="checkbox"
            defaultChecked={produtoInicial.ativo}
            onChange={(e) => {
              const hiddenInput = document.querySelector('input[name="ativo"]') as HTMLInputElement
              if (hiddenInput) {
                hiddenInput.value = e.target.checked ? 'true' : 'false'
              }
            }}
            className="rounded border-border-input text-primary-500"
          />
          <span className="text-text-primary font-medium">Produto Ativo</span>
        </label>
      </div>

      {/* Campo oculto para ID */}
      <input type="hidden" name="id" value={produtoInicial.id} />

      <div className="flex items-center justify-end gap-4 pt-6 border-t border-border">
        <button
          type="submit"
          className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md font-medium transition-colors"
        >
          Salvar Alterações
        </button>
      </div>

      {showError && state?.error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
          {state.error}
        </div>
      )}
    </form>
  )
}
