import { requireModulo } from '@/lib/guard'
import { getConfigClinica } from '@/lib/clinica'
import { ClinicaConfigClient } from './ClinicaConfigClient'

export default async function ClinicaConfigPage() {
  await requireModulo('configuracoes:clinica')
  const config = await getConfigClinica()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dados da Clínica</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure as informações institucionais que serão exibidas nos documentos gerados.
        </p>
      </div>

      <ClinicaConfigClient config={config} />
    </div>
  )
}