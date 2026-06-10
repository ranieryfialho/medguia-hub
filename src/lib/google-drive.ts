import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function lerConfig(chave: string): Promise<string | null> {
  const db = createAdminClient()
  const { data } = await db
    .from('configuracoes_sistema')
    .select('valor')
    .eq('chave', chave)
    .maybeSingle()
  return data?.valor ?? null
}

async function salvarConfig(chave: string, valor: string): Promise<void> {
  const db = createAdminClient()
  await db.from('configuracoes_sistema').upsert({
    chave,
    valor,
    atualizado_em: new Date().toISOString(),
  })
}

export function criarOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  )
}

export function gerarUrlAutorizacao(): string {
  const client = criarOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
  })
}

export async function salvarTokensGoogle(code: string): Promise<{ email?: string }> {
  const client = criarOAuthClient()
  const { tokens } = await client.getToken(code)

  if (tokens.refresh_token) {
    await salvarConfig('google_drive_refresh_token', tokens.refresh_token)
  }
  if (tokens.access_token) {
    await salvarConfig('google_drive_access_token', tokens.access_token)
  }
  if (tokens.expiry_date) {
    await salvarConfig('google_drive_token_expiry', tokens.expiry_date.toString())
  }

  client.setCredentials(tokens)

  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const { data: userInfo } = await oauth2.userinfo.get()
    if (userInfo.email) {
      await salvarConfig('google_drive_email', userInfo.email)
    }
    return { email: userInfo.email ?? undefined }
  } catch {
    return {}
  }
}

export async function getClienteAutenticado() {
  const refreshToken = await lerConfig('google_drive_refresh_token')
  if (!refreshToken) throw new Error('Google Drive não conectado')

  const client = criarOAuthClient()

  const [accessToken, expiryStr] = await Promise.all([
    lerConfig('google_drive_access_token'),
    lerConfig('google_drive_token_expiry'),
  ])

  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0
  const tokenValido = accessToken && expiry > Date.now() + 60_000

  if (tokenValido) {
    client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
      expiry_date: expiry,
    })
    return client
  }

  client.setCredentials({ refresh_token: refreshToken })

  try {
    const { credentials } = await client.refreshAccessToken()

    if (credentials.access_token) {
      await salvarConfig('google_drive_access_token', credentials.access_token)
    }
    if (credentials.expiry_date) {
      await salvarConfig('google_drive_token_expiry', credentials.expiry_date.toString())
    }

    client.setCredentials(credentials)
    return client
  } catch (err) {
    console.error('[Drive] Falha ao renovar token de acesso:', err)
    // Limpa o access token expirado para evitar reuso futuro
    await salvarConfig('google_drive_access_token', '')
    await salvarConfig('google_drive_token_expiry', '0')
    throw new Error('Google Drive: sessão expirada ou revogada. Reconecte a conta em Configurações → Google Drive.')
  }
}

async function buscarOuCriarPastaRaiz(): Promise<string> {
  const pastaRaizId = await lerConfig('google_drive_pasta_raiz_id')
  if (pastaRaizId) return pastaRaizId

  const auth = await getClienteAutenticado()
  const drive = google.drive({ version: 'v3', auth })

  const { data: resultado } = await drive.files.list({
    q: "name = 'MedGuia - Pacientes' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id)',
    spaces: 'drive',
  })

  if (resultado.files?.length && resultado.files[0].id) {
    const id = resultado.files[0].id
    await salvarConfig('google_drive_pasta_raiz_id', id)
    return id
  }

  const { data: novaRaiz } = await drive.files.create({
    requestBody: {
      name: 'MedGuia - Pacientes',
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  })

  if (!novaRaiz.id) throw new Error('Falha ao criar pasta raiz no Drive')

  await salvarConfig('google_drive_pasta_raiz_id', novaRaiz.id)
  return novaRaiz.id
}

function sanitizarNomePasta(nome: string): string {
  return nome
    .replace(/[/\\]/g, '-')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 100)
}

export async function criarPastaPacienteNoDrive(
  pacienteId: string,
  nome: string,
): Promise<{ folderId: string; folderUrl: string }> {
  const pastaRaizId = await buscarOuCriarPastaRaiz()
  const auth = await getClienteAutenticado()
  const drive = google.drive({ version: 'v3', auth })

  const idShort = pacienteId.replace(/-/g, '').slice(0, 8).toUpperCase()
  const nomePasta = sanitizarNomePasta(`${nome} [${idShort}]`)

  const { data: folder } = await drive.files.create({
    requestBody: {
      name: nomePasta,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [pastaRaizId],
    },
    fields: 'id, webViewLink',
  })

  if (!folder.id || !folder.webViewLink) throw new Error('Falha ao criar pasta do paciente')

  return { folderId: folder.id, folderUrl: folder.webViewLink }
}

export async function criarPastaAtendimentoNoDrive(
  pastaRaizPacienteId: string,
  data: string,
  tipo: string,
): Promise<{ folderId: string; folderUrl: string }> {
  const auth = await getClienteAutenticado()
  const drive = google.drive({ version: 'v3', auth })

  const tipoNormalizado = tipo?.trim() || 'Consulta'
  const nomePasta = sanitizarNomePasta(`${data} - ${tipoNormalizado}`)

  const { data: folder } = await drive.files.create({
    requestBody: {
      name: nomePasta,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [pastaRaizPacienteId],
    },
    fields: 'id, webViewLink',
  })

  if (!folder.id || !folder.webViewLink) throw new Error('Falha ao criar pasta do atendimento')

  return { folderId: folder.id, folderUrl: folder.webViewLink }
}

export async function getStatusConexao(): Promise<{ conectado: boolean; email?: string; tokenInvalido?: boolean }> {
  const refreshToken = await lerConfig('google_drive_refresh_token')
  if (!refreshToken) return { conectado: false }

  const email = await lerConfig('google_drive_email')

  // Verifica se o access token salvo ainda é válido (sem chamada de rede)
  const [accessToken, expiryStr] = await Promise.all([
    lerConfig('google_drive_access_token'),
    lerConfig('google_drive_token_expiry'),
  ])
  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0
  const accessValido = accessToken && expiry > Date.now() + 60_000

  // Se o access token está expirado/ausente, tenta renovar para confirmar validade
  if (!accessValido) {
    try {
      await getClienteAutenticado()
    } catch {
      // Refresh token inválido — conexão precisa ser refeita
      return { conectado: false, tokenInvalido: true, email: email ?? undefined }
    }
  }

  return { conectado: true, email: email ?? undefined }
}

export async function removerConexao(): Promise<void> {
  const db = createAdminClient()
  await db.from('configuracoes_sistema').delete().in('chave', [
    'google_drive_refresh_token',
    'google_drive_access_token',
    'google_drive_token_expiry',
    'google_drive_email',
    'google_drive_pasta_raiz_id',
  ])
}
