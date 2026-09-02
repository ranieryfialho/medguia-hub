/**
 * T-012 — avatar do paciente na agenda (views dia e semana).
 *
 * Prova estática (mesmo padrão de AvatarPaciente.pontos-renderizacao.test.ts):
 * confirma que as 4 variantes da query usada pelas views dia/semana passam a
 * selecionar `foto_drive_file_id`/`foto_atualizada_em` de `pacientes` (AC-104)
 * e que o bloco da view mês — que não usa essa query e não recebe
 * `AvatarPaciente` — permanece intocado (AC-105).
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

const fonteAgendaPage = lerFonte('./page.tsx')

function extrairBloco(fonte: string, inicioMarcador: string, fimMarcador: string): string {
  const inicio = fonte.indexOf(inicioMarcador)
  assert.notEqual(inicio, -1, `não encontrei "${inicioMarcador}" no arquivo`)
  const fim = fonte.indexOf(fimMarcador, inicio + inicioMarcador.length)
  assert.notEqual(fim, -1, `não encontrei "${fimMarcador}" após o marcador inicial`)
  return fonte.slice(inicio, fim)
}

test('@spec:AC-104 as 4 variantes da query de dia/semana selecionam foto_drive_file_id e foto_atualizada_em', () => {
  const blocoQueryDiaSemana = extrairBloco(
    fonteAgendaPage,
    "const usarQueryLeveAgenda = view === 'semana' || view === 'dia'",
    'const agendamentosQueryFiltrada = shouldFilterByStatus',
  )
  const ocorrenciasLeves = blocoQueryDiaSemana.match(/pacientes \(nome, foto_drive_file_id, foto_atualizada_em\)/g) ?? []
  const ocorrenciasComContato = blocoQueryDiaSemana.match(
    /pacientes \(nome, telefone, email, foto_drive_file_id, foto_atualizada_em\)/g,
  ) ?? []
  assert.equal(ocorrenciasLeves.length, 2, 'esperadas as 2 variantes leves (com/sem filtro de profissional) com foto')
  assert.equal(ocorrenciasComContato.length, 2, 'esperadas as 2 variantes com telefone/email (com/sem filtro de profissional) com foto')
  assert.doesNotMatch(blocoQueryDiaSemana, /pacientes \(nome\)(?!,)/, 'nenhuma variante deveria ter ficado sem os campos de foto')
})

test('@spec:AC-105 a query da view mês (agendamentosMesLevesQuery) não seleciona campos de paciente/foto', () => {
  const blocoMes = extrairBloco(
    fonteAgendaPage,
    'const agendamentosMesLevesQuery',
    'const { data: agendamentosMesLeves }',
  )
  assert.match(blocoMes, /\.select\('id, data_agendamento, status'\)/)
  assert.doesNotMatch(blocoMes, /foto_drive_file_id/)
  assert.doesNotMatch(blocoMes, /pacientes/i)
})

test('@spec:AC-105 o JSX da view mês não renderiza AvatarPaciente', () => {
  const inicioViewMes = fonteAgendaPage.indexOf("{view === 'mes' && (")
  assert.notEqual(inicioViewMes, -1, 'bloco JSX da view mês não encontrado')
  const inicioColunaDireita = fonteAgendaPage.indexOf('COLUNA DIREITA', inicioViewMes)
  const blocoViewMesJsx = fonteAgendaPage.slice(inicioViewMes, inicioColunaDireita === -1 ? undefined : inicioColunaDireita)
  assert.doesNotMatch(blocoViewMesJsx, /AvatarPaciente/, 'a view mês não deve importar/renderizar AvatarPaciente (Decisão F da RFC)')
})

test('@spec:AC-105 page.tsx não importa AvatarPaciente diretamente (a renderização é responsabilidade de AgendamentoItem)', () => {
  assert.doesNotMatch(fonteAgendaPage, /AvatarPaciente/)
})
