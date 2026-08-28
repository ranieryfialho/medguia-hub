import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// FormEditarVenda.tsx é JSX e não pode ser importado diretamente pelo `node --test`
// (Node não faz transform de JSX, só strip de tipos). A função pura que decide o
// valor de venda_em_consultorio a enviar não depende de JSX nem de módulos do
// Next/React, então extraímos seu código-fonte real do arquivo e o executamos
// isoladamente — isso garante que o teste quebra se a lógica shippada mudar.
const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'FormEditarVenda.tsx')
const source = readFileSync(sourcePath, 'utf8')

const match = source.match(
  /export function resolverVendaEmConsultorioParaEnvio\(origem: string, toggleAtivo: boolean\): boolean \| null \{([\s\S]*?)\n\}/
)
assert.ok(match, 'resolverVendaEmConsultorioParaEnvio não encontrada em FormEditarVenda.tsx')

const resolverVendaEmConsultorioParaEnvio = new Function(
  'origem',
  'toggleAtivo',
  match![1]
) as (origem: string, toggleAtivo: boolean) => boolean | null

test('@spec:AC-061 valor do toggle só é enviado quando a origem é medico', () => {
  assert.equal(resolverVendaEmConsultorioParaEnvio('medico', true), true)
  assert.equal(resolverVendaEmConsultorioParaEnvio('medico', false), false)
})

test('@spec:AC-062 troca de origem para não-medico limpa o valor enviado para null', () => {
  assert.equal(resolverVendaEmConsultorioParaEnvio('leads', true), null)
  assert.equal(resolverVendaEmConsultorioParaEnvio('indicacao', true), null)
  assert.equal(resolverVendaEmConsultorioParaEnvio('renovacao', true), null)
  assert.equal(resolverVendaEmConsultorioParaEnvio('campanha', false), null)
})
