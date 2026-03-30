'use client'

import { Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

export function FiltrosPacientes() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const showInativos = searchParams.get('inativos') === 'true'

  const toggleInativos = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set('inativos', 'true')
    } else {
      params.delete('inativos')
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="p-4 flex items-center gap-4 border-b border-border">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
        <input 
          type="text" 
          placeholder="Procurar..." 
          className="w-full pl-10 pr-4 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 transition-colors"
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm text-text-secondary font-medium">Tags:</span>
        <select className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500 min-w-[120px]">
          <option>Nenhum</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-text-secondary shrink-0 ml-2 cursor-pointer">
        <input 
          type="checkbox" 
          checked={showInativos}
          onChange={(e) => toggleInativos(e.target.checked)}
          className="rounded border-border-input text-primary-500 focus:ring-primary-500 cursor-pointer" 
        />
        Exibir inativos
      </label>
    </div>
  )
}