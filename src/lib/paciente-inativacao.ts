const PREFIXO_INATIVACAO = '[[STATUS_INATIVACAO:'

export type MetadataInativacaoPaciente = {
  motivo: string
  obito: boolean
}

export function extrairMetadataInativacao(observacoes: string | null | undefined) {
  const texto = observacoes ?? ''
  const linhas = texto.split('\n')
  const primeiraLinha = linhas[0]?.trim() ?? ''

  if (!primeiraLinha.startsWith(PREFIXO_INATIVACAO) || !primeiraLinha.endsWith(']]')) {
    return {
      motivo: '',
      obito: false,
      observacoesLimpa: texto,
    }
  }

  try {
    const payload = primeiraLinha.slice(PREFIXO_INATIVACAO.length, -2)
    const data = JSON.parse(decodeURIComponent(payload)) as Partial<MetadataInativacaoPaciente>
    return {
      motivo: data.motivo ?? '',
      obito: data.obito === true,
      observacoesLimpa: linhas.slice(1).join('\n').trim(),
    }
  } catch {
    return {
      motivo: '',
      obito: false,
      observacoesLimpa: texto,
    }
  }
}

export function atualizarMetadataInativacao(
  observacoes: string | null | undefined,
  options: {
    ativo: boolean
    motivo: string
    obito: boolean
  },
) {
  const extraida = extrairMetadataInativacao(observacoes)
  const observacoesBase = extraida.observacoesLimpa.trim()

  if (options.ativo) {
    return observacoesBase
  }

  const motivoNormalizado = options.motivo.trim() || (options.obito ? 'Óbito' : '')
  const metadata = encodeURIComponent(JSON.stringify({
    motivo: motivoNormalizado,
    obito: options.obito,
  }))
  const cabecalho = `${PREFIXO_INATIVACAO}${metadata}]]`

  return observacoesBase ? `${cabecalho}\n${observacoesBase}` : cabecalho
}
