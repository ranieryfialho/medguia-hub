import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_COMPROVANTES_VENDA,
  extensaoDoNome,
  parseComprovantesJson,
  parseComprovantesVenda,
  serializarComprovantes,
} from './comprovantes-venda.ts'

// comprovantes-venda.ts é TS puro (sem JSX, sem alias @/), então o `node --test`
// importa o módulo shippado de verdade — nada de extrair o fonte com regex.

test('lê a lista do JSONB quando a coluna nova está preenchida, com rótulo genérico exibido', () => {
  const comprovantes = parseComprovantesVenda({
    comprovantes_pagamento: [
      { file_id: 'a', file_url: 'https://drive/a', nome: 'entrada.pdf' },
      { file_id: 'b', file_url: null, nome: 'parcela.jpg' },
    ],
    comprovante_pagamento_google_drive_file_id: 'a',
    comprovante_pagamento_google_drive_file_url: 'https://drive/a',
    comprovante_pagamento_nome: 'entrada.pdf',
  })

  assert.deepEqual(comprovantes, [
    { fileId: 'a', fileUrl: 'https://drive/a', nome: 'Comprovante de venda 1', extensao: '.pdf' },
    { fileId: 'b', fileUrl: null, nome: 'Comprovante de venda 2', extensao: '.jpg' },
  ])
})

test('venda legada (JSONB vazio) cai nas colunas escalares antigas', () => {
  const comprovantes = parseComprovantesVenda({
    comprovantes_pagamento: null,
    comprovante_pagamento_google_drive_file_id: 'legado',
    comprovante_pagamento_google_drive_file_url: 'https://drive/legado',
    comprovante_pagamento_nome: 'comprovante.pdf',
  })

  assert.deepEqual(comprovantes, [
    { fileId: 'legado', fileUrl: 'https://drive/legado', nome: 'Comprovante de venda', extensao: '.pdf' },
  ])
})

test('venda sem nenhum comprovante devolve lista vazia', () => {
  assert.deepEqual(parseComprovantesVenda({}), [])
  assert.deepEqual(parseComprovantesVenda(null), [])
})

test('itens sem file_id são descartados e duplicados são removidos', () => {
  const comprovantes = parseComprovantesVenda({
    comprovantes_pagamento: [
      { file_id: 'a', file_url: null, nome: 'um.pdf' },
      { file_id: '  ', file_url: null, nome: 'vazio.pdf' },
      { file_id: 'a', file_url: null, nome: 'duplicado.pdf' },
      null,
    ],
  })

  assert.deepEqual(comprovantes.map((c) => c.fileId), ['a'])
})

test('item sem nome, exibido, ganha o rótulo genérico', () => {
  const [comprovante] = parseComprovantesVenda({
    comprovantes_pagamento: [{ file_id: 'a', file_url: null, nome: '' }],
  })

  assert.equal(comprovante.nome, 'Comprovante de venda')
})

test('a lista nunca passa do limite por venda', () => {
  const excesso = Array.from({ length: MAX_COMPROVANTES_VENDA + 5 }, (_, i) => ({
    file_id: `id-${i}`,
    file_url: null,
    nome: `arquivo-${i}.pdf`,
  }))

  assert.equal(parseComprovantesVenda({ comprovantes_pagamento: excesso }).length, MAX_COMPROVANTES_VENDA)
  assert.equal(parseComprovantesJson(JSON.stringify(excesso)).length, MAX_COMPROVANTES_VENDA)
})

test('o JSON do formulário (gravação) preserva o nome real do arquivo, sem o rótulo genérico', () => {
  const original = [
    { fileId: 'a', fileUrl: 'https://drive/a', nome: 'entrada.pdf', extensao: '.pdf' },
    { fileId: 'b', fileUrl: null, nome: 'parcela.jpg', extensao: '.jpg' },
  ]

  assert.deepEqual(parseComprovantesJson(JSON.stringify(serializarComprovantes(original))), original)
})

test('JSON inválido ou vazio vindo do formulário não quebra', () => {
  assert.deepEqual(parseComprovantesJson('não é json'), [])
  assert.deepEqual(parseComprovantesJson(''), [])
  assert.deepEqual(parseComprovantesJson(null), [])
  assert.deepEqual(parseComprovantesJson('{"file_id":"a"}'), [])
})

test('extensaoDoNome extrai a extensão ou devolve vazio', () => {
  assert.equal(extensaoDoNome('foto.jpg'), '.jpg')
  assert.equal(extensaoDoNome('9763a64c-4c5a-4082-b4f8-abcdef123456.PNG'), '.PNG')
  assert.equal(extensaoDoNome('sem-extensao'), '')
  assert.equal(extensaoDoNome('termina.em.ponto.'), '')
})
