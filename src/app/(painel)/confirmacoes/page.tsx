import { getUsuarioComPermissoes } from '@/lib/guard'
import { obterPrimeiraRotaLiberadaDoGrupo } from '@/lib/modulos'
import { redirect } from 'next/navigation'

export default async function ConfirmacoesPage() {
  const { modulos } = await getUsuarioComPermissoes()
  const rota = obterPrimeiraRotaLiberadaDoGrupo(modulos, 'confirmacoes')

  redirect(rota ?? '/dashboard')
}
