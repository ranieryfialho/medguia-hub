// Rotina de limpeza de arquivos órfãos no Drive (T-014, AC-111). Consome os
// registros que `processarUploadFoto` (src/app/api/pacientes/[id]/foto/route.ts)
// grava quando falha ao apagar o `fileId` da foto anterior numa troca — o
// caso previsto no §5.3 do TDD 006 ("trocamos um risco de lixo por um risco
// de perda de dado").
//
// `limparArquivosOrfaosDrive` recebe as dependências (leitura/escrita da
// lista de pendentes, cliente do Drive) por parâmetro para poder ser testada
// sem o runtime do Next — `../actions/google-drive.ts` é uma action
// ('use server') que importa `next/navigation`/`next/cache` e não resolve
// fora do runtime do Next, por isso `executarLimpezaOrfaosDrive` só a
// importa dinamicamente, dentro da função, no caminho de produção.

import { google } from 'googleapis'
import { getClienteAutenticado } from './google-drive.ts'

export interface ArquivoOrfaoPendente {
  pacienteId: string
  fileId: string
  registradoEm: string
}

export interface DriveApiCliente {
  files: {
    update: (args: unknown) => Promise<unknown>
  }
}

export interface DepsLimpezaOrfaosDrive {
  listarPendentes: () => Promise<ArquivoOrfaoPendente[]>
  removerPendente: (fileId: string) => Promise<void>
  criarClienteDrive: () => Promise<DriveApiCliente>
}

export interface ResultadoLimpezaOrfaosDrive {
  removidos: string[]
  falhas: string[]
}

/**
 * Percorre os arquivos órfãos pendentes e move cada um para a lixeira do
 * Drive. Só tira o registro da lista de pendentes depois que o Drive
 * confirma a remoção (AC-111) — falha isolada num arquivo não impede a
 * tentativa dos demais nem derruba a rotina.
 */
export async function limparArquivosOrfaosDrive(
  deps: DepsLimpezaOrfaosDrive,
): Promise<ResultadoLimpezaOrfaosDrive> {
  const pendentes = await deps.listarPendentes()
  if (pendentes.length === 0) return { removidos: [], falhas: [] }

  const drive = await deps.criarClienteDrive()

  const removidos: string[] = []
  const falhas: string[] = []

  for (const pendente of pendentes) {
    try {
      await drive.files.update({ fileId: pendente.fileId, requestBody: { trashed: true } })
      await deps.removerPendente(pendente.fileId)
      removidos.push(pendente.fileId)
    } catch (err) {
      console.error('[Limpeza Órfãos Drive] Falha ao remover arquivo órfão:', pendente.fileId, err)
      falhas.push(pendente.fileId)
    }
  }

  return { removidos, falhas }
}

async function criarClienteDriveReal(): Promise<DriveApiCliente> {
  const auth = await getClienteAutenticado()
  return google.drive({ version: 'v3', auth }) as unknown as DriveApiCliente
}

/** Ponto de entrada de produção: liga a rotina pura acima às dependências reais (banco + Drive). */
export async function executarLimpezaOrfaosDrive(): Promise<ResultadoLimpezaOrfaosDrive> {
  const { listarArquivosOrfaosDrivePendentes, removerArquivoOrfaoDrivePendente } = await import(
    '../actions/google-drive.ts'
  )

  return limparArquivosOrfaosDrive({
    listarPendentes: listarArquivosOrfaosDrivePendentes,
    removerPendente: removerArquivoOrfaoDrivePendente,
    criarClienteDrive: criarClienteDriveReal,
  })
}
