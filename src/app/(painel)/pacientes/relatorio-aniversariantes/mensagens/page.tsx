import { listarTemplates } from '@/actions/templates'
import { GerenciadorMensagens } from '@/components/features/contatos'
import { Cake, ArrowLeft } from 'lucide-react'
import { requireModulo } from '@/lib/guard'
import Link from 'next/link'

export default async function MensagensAniversariantesPage() {
  await requireModulo('pacientes')

  const templates = await listarTemplates()

  return (
    <div className="w-full space-y-6">
      <div>
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">
            Pacientes
          </Link>
          <span>/</span>
          <Link href="/pacientes/relatorio-aniversariantes" className="hover:text-primary-500 transition-colors">
            Aniversariantes
          </Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Mensagens</span>
        </div>

        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
          <Cake size={24} className="text-[#006b5a]" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">
              Mensagens de Aniversário
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {templates.length} template{templates.length !== 1 ? 's' : ''} de aniversário —
              templates padrão visíveis a todos; os seus são privados e editáveis
            </p>
          </div>
          <Link
            href="/pacientes/relatorio-aniversariantes"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#006b5a] transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar ao relatório
          </Link>
        </div>
      </div>

      <GerenciadorMensagens templates={templates} abaInicial="aniversario" />
    </div>
  )
}