import { requireModulo } from '@/lib/guard'
import { buscarStatusConexaoGoogle, buscarStatsMigracao } from '@/actions/google-drive'
import { GoogleDriveConfigClient } from './GoogleDriveConfigClient'

type PageProps = {
  searchParams: Promise<{ conectado?: string; erro?: string }>
}

export default async function GoogleDrivePage({ searchParams }: PageProps) {
  await requireModulo('configuracoes:jornada')

  const params = await searchParams
  const [status, stats] = await Promise.all([
    buscarStatusConexaoGoogle(),
    buscarStatsMigracao(),
  ])

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#083142]">Google Drive</h1>
        <p className="mt-1 text-sm text-[#6d7a75]">
          Conecte o Google Drive para armazenar fotos e vídeos da evolução dos pacientes de forma organizada.
        </p>
      </div>

      {params.conectado === 'true' && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
          Google Drive conectado com sucesso!
        </div>
      )}
      {params.erro === 'acesso_negado' && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
          Acesso negado. Tente novamente e autorize o acesso ao Google Drive.
        </div>
      )}
      {params.erro === 'falha_auth' && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
          Falha na autenticação. Verifique as credenciais do Google Cloud e tente novamente.
        </div>
      )}

      <GoogleDriveConfigClient
        status={status}
        statsInicial={stats}
      />
    </div>
  )
}
