import { createClient } from '@supabase/supabase-js'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export type ConfigClinica = {
  // Identificação
  nome: string | null
  cnpj: string | null
  especialidade: string | null
  // Contato
  telefone: string | null
  whatsapp: string | null
  email: string | null
  site: string | null
  // Endereço
  endereco: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_estado: string | null
  endereco_cep: string | null
  // Logo
  logo_url: string | null
}

const CHAVES_CLINICA = [
  'clinica_nome',
  'clinica_cnpj',
  'clinica_especialidade',
  'clinica_telefone',
  'clinica_whatsapp',
  'clinica_email',
  'clinica_site',
  'clinica_endereco',
  'clinica_endereco_numero',
  'clinica_endereco_complemento',
  'clinica_endereco_bairro',
  'clinica_endereco_cidade',
  'clinica_endereco_estado',
  'clinica_endereco_cep',
  'clinica_logo_url',
] as const

export async function getConfigClinica(): Promise<ConfigClinica> {
  const db = createServiceClient()
  const { data } = await db
    .from('configuracoes_sistema')
    .select('chave, valor')
    .in('chave', CHAVES_CLINICA as unknown as string[])

  const map = Object.fromEntries(
    (data ?? []).map((r: { chave: string; valor: string }) => [r.chave, r.valor || null]),
  )

  return {
    nome: map.clinica_nome ?? null,
    cnpj: map.clinica_cnpj ?? null,
    especialidade: map.clinica_especialidade ?? null,
    telefone: map.clinica_telefone ?? null,
    whatsapp: map.clinica_whatsapp ?? null,
    email: map.clinica_email ?? null,
    site: map.clinica_site ?? null,
    endereco: map.clinica_endereco ?? null,
    endereco_numero: map.clinica_endereco_numero ?? null,
    endereco_complemento: map.clinica_endereco_complemento ?? null,
    endereco_bairro: map.clinica_endereco_bairro ?? null,
    endereco_cidade: map.clinica_endereco_cidade ?? null,
    endereco_estado: map.clinica_endereco_estado ?? null,
    endereco_cep: map.clinica_endereco_cep ?? null,
    logo_url: map.clinica_logo_url ?? null,
  }
}

export function enderecoCompleto(c: ConfigClinica): string | null {
  const partes = [
    c.endereco,
    c.endereco_numero ? `nº ${c.endereco_numero}` : null,
    c.endereco_complemento,
    c.endereco_bairro,
    c.endereco_cidade && c.endereco_estado
      ? `${c.endereco_cidade}/${c.endereco_estado}`
      : c.endereco_cidade ?? c.endereco_estado,
    c.endereco_cep ? `CEP ${c.endereco_cep}` : null,
  ].filter(Boolean)
  return partes.length ? partes.join(', ') : null
}

export async function urlParaDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error('[urlParaDataUrl] resposta não-OK ao buscar imagem', url, res.status)
      return null
    }
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.error('[urlParaDataUrl] falha ao buscar/converter imagem', url, err)
    return null
  }
}