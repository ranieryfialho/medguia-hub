import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { requireModulo } from '@/lib/guard'
import { FormEditarColaborador } from '@/components/features/equipe'
import { normalizarCargoOperacional } from '@/lib/modulos'

export default async function EditarColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModulo('equipe:membros')

  const supabase = await createClient()

  // 1. Resolução correta da Promise de parâmetros do Next.js 15
  const resolvedParams = await params
  const colaboradorId = resolvedParams.id

  // 2. Busca os dados atuais do colaborador pelo ID
  const { data: colaborador, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', colaboradorId)
    .single()

  // Se não encontrar o colaborador (ou se o ID for inválido), mostra a tela de 404
  if (error || !colaborador) {
    notFound()
  }

  // 3. BYPASS DE TIPAGEM: Evita erro de TypeScript pois as colunas foram criadas via SQL
  const dadosColab = colaborador as any

  // Normaliza os nomes das colunas
  const nomeAtual = dadosColab.nome || dadosColab.full_name || ''
  const cargoAtual = normalizarCargoOperacional(dadosColab.cargo || dadosColab.role)
  const nivelAcessoAtual = dadosColab.nivel_acesso || 'basico'

  return (
    <FormEditarColaborador
      colaborador={{
        id: dadosColab.id,
        nome: nomeAtual,
        cpf: dadosColab.cpf || '',
        email: dadosColab.email || '',
        telefone: dadosColab.telefone || '',
        cargo: cargoAtual,
        nivelAcesso: nivelAcessoAtual,
        conselho: dadosColab.conselho || '',
        especialidade: dadosColab.especialidade || '',
      }}
    />
  )
}
