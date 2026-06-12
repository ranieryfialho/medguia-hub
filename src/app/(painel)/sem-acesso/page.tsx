import Link from 'next/link'
import { ShieldX, ArrowLeft } from 'lucide-react'
import { GRUPOS_MODULOS } from '@/lib/modulos'

export default async function SemAcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const modulo = (params.modulo as string) || ''

  const labelModulo = GRUPOS_MODULOS
    .flatMap(g => g.modulos)
    .find(m => m.chave === modulo)?.label ?? modulo

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">

        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center shadow-sm">
            <ShieldX size={38} className="text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-800">Acesso negado</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Você não tem permissão para acessar{' '}
            {labelModulo ? (
              <strong className="text-slate-700">{labelModulo}</strong>
            ) : (
              'este módulo'
            )}
            .
          </p>
          <p className="text-slate-400 text-xs">
            Solicite acesso ao gestor ou administrador do sistema.
          </p>
        </div>

        {modulo && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-xs text-slate-500 font-mono">
            <ShieldX size={11} />
            {modulo}
          </div>
        )}

        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006b5a] hover:bg-[#005143] text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-[#006b5a]/20"
          >
            <ArrowLeft size={15} />
            Voltar ao Dashboard
          </Link>
        </div>

      </div>
    </div>
  )
}
