import { test } from 'node:test'
import assert from 'node:assert/strict'
import { limparArquivosOrfaosDrive, type ArquivoOrfaoPendente, type DriveApiCliente } from './limpeza-orfaos-drive.ts'

function criarDriveMock(opts: { falharPara?: Set<string> } = {}) {
  const chamadasUpdate: unknown[] = []
  const drive: DriveApiCliente = {
    files: {
      update: async (args: unknown) => {
        chamadasUpdate.push(args)
        const { fileId } = args as { fileId: string }
        if (opts.falharPara?.has(fileId)) throw new Error(`Falha simulada ao apagar ${fileId}`)
        return {}
      },
    },
  }
  return { drive, chamadasUpdate }
}

function criarDepsMock(pendentesIniciais: ArquivoOrfaoPendente[], opts: { falharPara?: Set<string> } = {}) {
  let pendentes = [...pendentesIniciais]
  const removidos: string[] = []
  const { drive, chamadasUpdate } = criarDriveMock(opts)

  const deps = {
    listarPendentes: async () => pendentes,
    removerPendente: async (fileId: string) => {
      pendentes = pendentes.filter(p => p.fileId !== fileId)
      removidos.push(fileId)
    },
    criarClienteDrive: async () => drive,
  }

  return { deps, chamadasUpdate, removidos, pendentesAtuais: () => pendentes }
}

test('@spec:AC-111 rotina remove do Drive um arquivo órfão registrado e ele deixa de constar como pendente', async () => {
  const pendente: ArquivoOrfaoPendente = {
    pacienteId: 'paciente-1',
    fileId: 'file-orfao-1',
    registradoEm: '2026-08-30T12:00:00.000Z',
  }
  const { deps, chamadasUpdate, removidos, pendentesAtuais } = criarDepsMock([pendente])

  const resultado = await limparArquivosOrfaosDrive(deps)

  assert.deepEqual(resultado.removidos, ['file-orfao-1'])
  assert.deepEqual(resultado.falhas, [])
  assert.deepEqual(chamadasUpdate, [{ fileId: 'file-orfao-1', requestBody: { trashed: true } }])
  assert.deepEqual(removidos, ['file-orfao-1'])
  assert.deepEqual(pendentesAtuais(), [])
})

test('@spec:AC-111 vários órfãos pendentes são todos removidos e todos saem da lista de pendentes', async () => {
  const pendentes: ArquivoOrfaoPendente[] = [
    { pacienteId: 'paciente-1', fileId: 'file-orfao-1', registradoEm: '2026-08-30T12:00:00.000Z' },
    { pacienteId: 'paciente-2', fileId: 'file-orfao-2', registradoEm: '2026-08-31T09:00:00.000Z' },
  ]
  const { deps, removidos, pendentesAtuais } = criarDepsMock(pendentes)

  const resultado = await limparArquivosOrfaosDrive(deps)

  assert.deepEqual(resultado.removidos.sort(), ['file-orfao-1', 'file-orfao-2'])
  assert.deepEqual(resultado.falhas, [])
  assert.deepEqual(removidos.sort(), ['file-orfao-1', 'file-orfao-2'])
  assert.deepEqual(pendentesAtuais(), [])
})

test('@spec:AC-111 sem nenhum órfão pendente, a rotina não chama o Drive nem remove nada', async () => {
  const { deps, chamadasUpdate, removidos } = criarDepsMock([])

  const resultado = await limparArquivosOrfaosDrive(deps)

  assert.deepEqual(resultado, { removidos: [], falhas: [] })
  assert.deepEqual(chamadasUpdate, [])
  assert.deepEqual(removidos, [])
})

test('@spec:AC-111 falha ao apagar um órfão no Drive mantém ele pendente, sem impedir a remoção dos demais', async () => {
  const pendentes: ArquivoOrfaoPendente[] = [
    { pacienteId: 'paciente-1', fileId: 'file-orfao-falha', registradoEm: '2026-08-30T12:00:00.000Z' },
    { pacienteId: 'paciente-2', fileId: 'file-orfao-ok', registradoEm: '2026-08-31T09:00:00.000Z' },
  ]
  const { deps, removidos, pendentesAtuais } = criarDepsMock(pendentes, { falharPara: new Set(['file-orfao-falha']) })

  const resultado = await limparArquivosOrfaosDrive(deps)

  assert.deepEqual(resultado.removidos, ['file-orfao-ok'])
  assert.deepEqual(resultado.falhas, ['file-orfao-falha'])
  assert.deepEqual(removidos, ['file-orfao-ok'])
  assert.deepEqual(pendentesAtuais(), [pendentes[0]])
})
