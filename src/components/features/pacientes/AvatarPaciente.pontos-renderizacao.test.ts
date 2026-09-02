/**
 * T-009 — migração dos 8 pontos de renderização existentes (iniciais cruas)
 * para o componente único `AvatarPaciente`.
 *
 * Mesma limitação de runner de componente documentada em
 * AvatarPaciente.test.ts e nos demais `page.test.ts` deste projeto: a prova
 * aqui é estática, confirmando no código-fonte que cada ponto (a) importa
 * `AvatarPaciente`, (b) passa `fotoDriveFileId`/`fotoAtualizadaEm` (quando a
 * fonte de dados permite) e (c) não sobrou nenhum bloco de iniciais
 * renderizado à mão no lugar do componente.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function lerFonte(caminhoRelativo: string) {
  return readFileSync(join(__dirname, caminhoRelativo), 'utf8')
}

const fonteProntuarioDigital = lerFonte('../../../app/(painel)/pacientes/[id]/page.tsx')
const fonteListaPacientes = lerFonte('../../../app/(painel)/pacientes/page.tsx')
const fonteCardConfirmacao = lerFonte('./CardConfirmacaoPaciente.tsx')
const fonteConfirmacoesSemana = lerFonte('../../../app/(painel)/confirmacoes/semana/page.tsx')
const fonteFollowUps = lerFonte('../../../app/(painel)/follow-ups/page.tsx')
const fonteProntuariosLista = lerFonte('../../../app/(painel)/prontuarios/page.tsx')
const fonteProntuarioAtendimento = lerFonte('../../../app/(painel)/prontuarios/[atendimentoId]/page.tsx')

// Bloco de iniciais renderizado à mão que a migração deveria ter eliminado
// (div com classes de avatar + `{iniciais...}` interpolado diretamente).
const REGEX_INICIAIS_CRUAS = /rounded-(full|lg|2xl|3xl)[^`]*?>\s*\{iniciais/

test('@spec:AC-096 @spec:AC-113 prontuário digital usa AvatarPaciente com foto e status do paciente (select "*")', () => {
  assert.match(fonteProntuarioDigital, /import AvatarPaciente from '@\/components\/features\/pacientes\/AvatarPaciente'/)
  assert.match(fonteProntuarioDigital, /<AvatarPaciente[\s\S]*?fotoDriveFileId=\{paciente\.foto_drive_file_id\}/)
  assert.match(fonteProntuarioDigital, /<AvatarPaciente[\s\S]*?fotoAtualizadaEm=\{paciente\.foto_atualizada_em\}/)
  assert.match(fonteProntuarioDigital, /<AvatarPaciente[\s\S]*?size="2xl"/)
  assert.match(fonteProntuarioDigital, /<AvatarPaciente[\s\S]*?isAtivo=\{isAtivo\}/)
  assert.match(fonteProntuarioDigital, /<AvatarPaciente[\s\S]*?mostrarStatus/)
  assert.match(fonteProntuarioDigital, /<AvatarPaciente[\s\S]*?ampliavel/)
  assert.doesNotMatch(fonteProntuarioDigital, REGEX_INICIAIS_CRUAS)
})

test('@spec:AC-096 @spec:AC-097 listagem de pacientes seleciona foto_drive_file_id e foto_atualizada_em', () => {
  assert.match(
    fonteListaPacientes,
    /'id, nome, cpf, email, telefone, recuperacao_base, convenio, ativo, observacoes_gerais, foto_drive_file_id, foto_atualizada_em'/,
  )
})

test('@spec:AC-096 @spec:AC-097 listagem de pacientes usa AvatarPaciente na tabela (sm) e nos cards (md)', () => {
  assert.match(fonteListaPacientes, /import AvatarPaciente from '@\/components\/features\/pacientes\/AvatarPaciente'/)
  const ocorrencias = fonteListaPacientes.match(/<AvatarPaciente/g) ?? []
  assert.equal(ocorrencias.length, 2, 'esperado um AvatarPaciente na tabela desktop e outro nos cards mobile')
  assert.match(fonteListaPacientes, /<AvatarPaciente[\s\S]*?size="sm"/)
  assert.match(fonteListaPacientes, /<AvatarPaciente[\s\S]*?size="md"/)
  assert.doesNotMatch(fonteListaPacientes, REGEX_INICIAIS_CRUAS)
})

test('@spec:AC-114 listagem de pacientes usa AvatarPaciente ampliável na tabela e nos cards', () => {
  const ocorrenciasAmpliavel = fonteListaPacientes.match(/<AvatarPaciente[\s\S]*?\/>/g) ?? []
  assert.equal(ocorrenciasAmpliavel.length, 2, 'esperado um AvatarPaciente na tabela desktop e outro nos cards mobile')
  for (const bloco of ocorrenciasAmpliavel) {
    assert.match(bloco, /ampliavel/, `AvatarPaciente da listagem deveria ter a prop ampliavel: ${bloco}`)
  }
})

test('@spec:AC-096 @spec:AC-100 @spec:AC-101 card de confirmação usa AvatarPaciente ampliável (md)', () => {
  assert.match(fonteCardConfirmacao, /import AvatarPaciente from '\.\/AvatarPaciente'/)
  assert.match(fonteCardConfirmacao, /fotoDriveFileId\?: string \| null/)
  assert.match(fonteCardConfirmacao, /fotoAtualizadaEm\?: string \| null/)
  assert.match(fonteCardConfirmacao, /<AvatarPaciente[\s\S]*?fotoDriveFileId=\{paciente\.fotoDriveFileId\}/)
  assert.match(fonteCardConfirmacao, /<AvatarPaciente[\s\S]*?size="md"/)
  assert.match(fonteCardConfirmacao, /<AvatarPaciente[\s\S]*?ampliavel/)
  assert.doesNotMatch(fonteCardConfirmacao, REGEX_INICIAIS_CRUAS)
})

test('@spec:AC-096 @spec:AC-097 confirmações da semana seleciona foto e usa AvatarPaciente (sm)', () => {
  assert.match(fonteConfirmacoesSemana, /paciente:pacientes\(id, nome, telefone, foto_drive_file_id, foto_atualizada_em\)/)
  assert.match(fonteConfirmacoesSemana, /import AvatarPaciente from '@\/components\/features\/pacientes\/AvatarPaciente'/)
  assert.match(fonteConfirmacoesSemana, /<AvatarPaciente[\s\S]*?fotoDriveFileId=\{a\.paciente\?\.foto_drive_file_id\}/)
  assert.match(fonteConfirmacoesSemana, /<AvatarPaciente[\s\S]*?size="sm"/)
  assert.doesNotMatch(fonteConfirmacoesSemana, REGEX_INICIAIS_CRUAS)
})

test('@spec:AC-096 @spec:AC-097 follow-ups seleciona foto e usa AvatarPaciente (sm)', () => {
  assert.match(fonteFollowUps, /paciente:pacientes\(id, nome, foto_drive_file_id, foto_atualizada_em\)/)
  assert.match(fonteFollowUps, /import AvatarPaciente from '@\/components\/features\/pacientes\/AvatarPaciente'/)
  assert.match(fonteFollowUps, /<AvatarPaciente[\s\S]*?fotoDriveFileId=\{paciente\?\.foto_drive_file_id\}/)
  assert.match(fonteFollowUps, /<AvatarPaciente[\s\S]*?size="sm"/)
  assert.doesNotMatch(fonteFollowUps, REGEX_INICIAIS_CRUAS)
})

test('@spec:AC-096 @spec:AC-097 prontuários (histórico) seleciona foto e usa AvatarPaciente (sm) nos dois pontos', () => {
  assert.match(fonteProntuariosLista, /pacientes:paciente_id\(id, nome, foto_drive_file_id, foto_atualizada_em\)/)
  assert.match(fonteProntuariosLista, /import AvatarPaciente from '@\/components\/features\/pacientes\/AvatarPaciente'/)
  const ocorrencias = fonteProntuariosLista.match(/<AvatarPaciente/g) ?? []
  assert.equal(ocorrencias.length, 2, 'esperado um AvatarPaciente na aba pendentes e outro na aba histórico')
  assert.match(fonteProntuariosLista, /<AvatarPaciente[\s\S]*?fotoDriveFileId=\{paciente\?\.foto_drive_file_id\}/)
  assert.doesNotMatch(fonteProntuariosLista, REGEX_INICIAIS_CRUAS)
})

test('@spec:AC-096 @spec:AC-100 @spec:AC-101 prontuário de atendimento seleciona foto e usa AvatarPaciente ampliável (lg)', () => {
  assert.match(fonteProntuarioAtendimento, /pacientes\(id, nome, convenio, telefone, foto_drive_file_id, foto_atualizada_em\)/)
  assert.match(fonteProntuarioAtendimento, /import AvatarPaciente from '@\/components\/features\/pacientes\/AvatarPaciente'/)
  assert.match(fonteProntuarioAtendimento, /<AvatarPaciente[\s\S]*?fotoDriveFileId=\{paciente\?\.foto_drive_file_id\}/)
  assert.match(fonteProntuarioAtendimento, /<AvatarPaciente[\s\S]*?size="lg"/)
  assert.match(fonteProntuarioAtendimento, /<AvatarPaciente[\s\S]*?ampliavel/)
  assert.doesNotMatch(fonteProntuarioAtendimento, REGEX_INICIAIS_CRUAS)
})

test('@spec:AC-099 nenhum dos 7 arquivos migrados constrói a URL da foto manualmente (delega para AvatarPaciente/construirUrlFoto)', () => {
  for (const [nome, fonte] of [
    ['prontuário digital', fonteProntuarioDigital],
    ['listagem de pacientes', fonteListaPacientes],
    ['card de confirmação', fonteCardConfirmacao],
    ['confirmações da semana', fonteConfirmacoesSemana],
    ['follow-ups', fonteFollowUps],
    ['prontuários (listagem)', fonteProntuariosLista],
    ['prontuário de atendimento', fonteProntuarioAtendimento],
  ] as const) {
    assert.doesNotMatch(fonte, /\/api\/drive\/file\//, `${nome} não deveria montar a URL do proxy de foto manualmente`)
  }
})
