import { getUsuarioComPermissoes } from '@/lib/guard'
import { obterPrimeiraRotaLiberadaDoGrupo } from '@/lib/modulos'
import { redirect } from 'next/navigation'

export default async function ConfiguracoesPage() {
  const { modulos } = await getUsuarioComPermissoes()
  const rota = obterPrimeiraRotaLiberadaDoGrupo(modulos, 'configuracoes')

  redirect(rota ?? '/dashboard')
}
