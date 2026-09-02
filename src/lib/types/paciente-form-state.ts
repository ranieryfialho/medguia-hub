export type PacienteDuplicado = {
  id: string
  nome: string
  cpf: string | null
  telefone: string | null
  email: string | null
  data_nascimento: string | null
  ativo: boolean | null
  score: number
  motivos: string[]
}

export type PacienteFormState = {
  error?: string
  warning?: string
  fields?: Record<string, unknown>
  duplicateCandidates?: PacienteDuplicado[]
  // AC-107: preenchido só quando o cadastro foi concluído com sucesso (sem CPF
  // duplicado nem candidato a duplicado) — permite o cliente prosseguir com o
  // upload da foto antes de navegar, sem redirect vindo do servidor.
  pacienteId?: string
}
