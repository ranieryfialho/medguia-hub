import { listarTemplates } from '@/actions/templates'
import { GerenciadorMensagens } from '@/components/features/contatos'
import { MessageSquare } from 'lucide-react'
import { requireModulo } from '@/lib/guard'

export default async function MensagensPage() {
  await requireModulo('confirmacoes:mensagens')

  const templates = await listarTemplates()

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <MessageSquare size={24} className="text-[#006b5a]" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">Mensagens</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {templates.length} {templates.length === 1 ? 'template' : 'templates'} criado{templates.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Gerenciador */}
      <GerenciadorMensagens templates={templates} />
    </div>
  )
}
