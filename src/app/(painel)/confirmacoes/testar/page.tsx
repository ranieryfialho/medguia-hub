import { redirect } from 'next/navigation'
import { getUsuarioComPermissoes } from '@/lib/guard'
import { TestarEnviosClient } from './TestarEnviosClient'

const DEV_EMAIL = 'ranieryfialho@gmail.com'

export default async function TestarEnviosPage() {
  const { user } = await getUsuarioComPermissoes()

  if (user.email !== DEV_EMAIL) {
    redirect('/dashboard')
  }

  return <TestarEnviosClient />
}
