import { FormNovoColaborador } from '@/components/features/FormNovoColaborador'
import { requireModulo } from '@/lib/guard'

export default async function NovoMembroEquipePage() {
  await requireModulo('equipe:membros')

  return <FormNovoColaborador />
}
