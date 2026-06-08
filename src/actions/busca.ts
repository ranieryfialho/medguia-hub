'use server'

import { createClient } from '@/lib/supabase/server'
import { temAcesso } from '@/lib/modulos'

export type ResultadoBusca = {
  id: string
  nome: string
  detalhe?: string
  tipo: 'paciente' | 'profissional'
  href: string
}

const CARGO_LABEL: Record<string, string> = {
  fisioterapeuta: 'Fisioterapeuta',
  medico: 'Médico',
  recepcionista: 'Recepcionista',
  gestor: 'Gestor',
}

export async function buscarGlobal(
  termo: string,
  modulosLiberados: string[],
): Promise<ResultadoBusca[]> {
  const termoBusca = termo.trim()
  if (termoBusca.length < 2) return []

  const supabase = await createClient()
  const resultados: ResultadoBusca[] = []

  if (temAcesso(modulosLiberados, 'pacientes')) {
    const termoCpf = termoBusca.replace(/\D/g, '')
    const buscaPorNome = /[A-Za-zÀ-ÿ]/.test(termoBusca)

    let query = supabase
      .from('pacientes')
      .select('id, nome, telefone, cpf')
      .not('ativo', 'is', 'false')
      .order('nome', { ascending: true })
      .limit(6)

    if (buscaPorNome) {
      query = query.ilike('nome', `%${termoBusca}%`)
    } else if (termoCpf.length >= 3) {
      query = query.ilike('cpf', `%${termoCpf}%`)
    }

    const { data } = await query
    for (const p of data ?? []) {
      resultados.push({
        id: p.id,
        nome: p.nome,
        detalhe: p.cpf ?? p.telefone ?? undefined,
        tipo: 'paciente',
        href: `/pacientes/${p.id}`,
      })
    }
  }

  if (temAcesso(modulosLiberados, 'equipe:membros')) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, especialidade')
      .ilike('full_name', `%${termoBusca}%`)
      .eq('ativo', true)
      .in('role', ['fisioterapeuta', 'medico', 'gestor', 'recepcionista'])
      .order('full_name', { ascending: true })
      .limit(4)

    for (const p of data ?? []) {
      const detalhe = p.especialidade ?? CARGO_LABEL[p.role ?? ''] ?? p.role ?? undefined
      resultados.push({
        id: p.id,
        nome: p.full_name ?? '',
        detalhe,
        tipo: 'profissional',
        href: `/equipe/${p.id}/editar`,
      })
    }
  }

  return resultados
}
