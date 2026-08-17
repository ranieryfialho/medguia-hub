import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const outputDir = path.join(repoRoot, 'docs')
const outputMd = path.join(outputDir, 'BACKUP_SUPABASE_PREPARACAO.md')
const outputJson = path.join(outputDir, 'backup-supabase-preparacao.json')

const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const dbEnvOptions = [
  'SUPABASE_DB_URL',
  'SUPABASE_DB_DIRECT_URL',
  'SUPABASE_DATABASE_URL',
]

const optionalEnv = [
  'SUPABASE_PROJECT_REF',
  'SUPABASE_ACCESS_TOKEN',
]

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function maskPresence(name) {
  return process.env[name] ? 'presente' : 'ausente'
}

function quote(value) {
  return `\`${value}\``
}

const dbEnvDetected = dbEnvOptions.find((name) => process.env[name]) ?? null
const requiredStatus = requiredEnv.map((name) => ({ name, status: maskPresence(name) }))
const optionalStatus = optionalEnv.map((name) => ({ name, status: maskPresence(name) }))

const readiness = {
  required_ok: requiredStatus.every((item) => item.status === 'presente'),
  db_url_ok: dbEnvDetected !== null,
  recommended_ok: optionalStatus.every((item) => item.status === 'presente'),
}

const backupFolderName = `backup-supabase-${new Date().toISOString().slice(0, 10)}`
const backupFolderPath = path.join(repoRoot, 'tmp', backupFolderName)
ensureDir(backupFolderPath)
ensureDir(outputDir)

const commands = [
  {
    step: 'Criar dump completo',
    command: dbEnvDetected
      ? `pg_dump --format=custom --no-owner --file "${path.join('tmp', backupFolderName, 'supabase-completo.dump')}" "$${dbEnvDetected}"`
      : 'Defina SUPABASE_DB_URL ou SUPABASE_DB_DIRECT_URL para gerar o comando de pg_dump.',
  },
  {
    step: 'Criar dump apenas de schema',
    command: dbEnvDetected
      ? `pg_dump --schema-only --no-owner --file "${path.join('tmp', backupFolderName, 'supabase-schema.sql')}" "$${dbEnvDetected}"`
      : 'Defina SUPABASE_DB_URL ou SUPABASE_DB_DIRECT_URL para gerar o comando de schema.',
  },
  {
    step: 'Criar dump apenas de dados',
    command: dbEnvDetected
      ? `pg_dump --data-only --no-owner --file "${path.join('tmp', backupFolderName, 'supabase-dados.sql')}" "$${dbEnvDetected}"`
      : 'Defina SUPABASE_DB_URL ou SUPABASE_DB_DIRECT_URL para gerar o comando de dados.',
  },
  {
    step: 'Gerar checksum local',
    command: `sha256sum "${path.join('tmp', backupFolderName, '*')}"`,
  },
]

const markdown = [
  '# Preparacao de Backup do Supabase',
  '',
  `Gerado em: ${new Date().toISOString()}`,
  '',
  '## Estado Atual',
  '',
  `- Pasta sugerida para backup: ${quote(path.relative(repoRoot, backupFolderPath).replaceAll(path.sep, '/'))}`,
  `- Variavel de banco detectada: ${dbEnvDetected ? quote(dbEnvDetected) : 'nenhuma'}`,
  `- Minimo para dump SQL pronto: ${readiness.required_ok && readiness.db_url_ok ? 'sim' : 'nao'}`,
  '',
  '## Variaveis Obrigatorias',
  '',
  ...requiredStatus.map((item) => `- ${quote(item.name)}: ${item.status}`),
  '',
  '## Variavel de Banco',
  '',
  ...dbEnvOptions.map((name) => `- ${quote(name)}: ${maskPresence(name)}`),
  '',
  '## Variaveis Opcionais',
  '',
  ...optionalStatus.map((item) => `- ${quote(item.name)}: ${item.status}`),
  '',
  '## Comandos Sugeridos',
  '',
]

for (const item of commands) {
  markdown.push(`### ${item.step}`)
  markdown.push('')
  markdown.push('```bash')
  markdown.push(item.command)
  markdown.push('```')
  markdown.push('')
}

markdown.push('## Checklist Operacional')
markdown.push('')
markdown.push('- Confirmar se a URL de banco apontada e a conexao direta do projeto Supabase.')
markdown.push('- Gerar dump completo antes de qualquer teste de migracao.')
markdown.push('- Gerar dump de schema e de dados separadamente.')
markdown.push('- Exportar arquivos de storage apenas se o projeto usar storage.')
markdown.push('- Salvar os backups em mais de um local.')
markdown.push('- Testar restauracao em ambiente isolado.')
markdown.push('')

markdown.push('## Observacao')
markdown.push('')
markdown.push('- Este script nao executa o backup. Ele prepara a pasta, valida variaveis e gera os comandos recomendados.')
markdown.push('')

fs.writeFileSync(outputMd, markdown.join('\n'))
fs.writeFileSync(outputJson, JSON.stringify({
  generated_at: new Date().toISOString(),
  backup_folder: path.relative(repoRoot, backupFolderPath).replaceAll(path.sep, '/'),
  required_env: requiredStatus,
  db_env_options: dbEnvOptions.map((name) => ({ name, status: maskPresence(name) })),
  optional_env: optionalStatus,
  readiness,
  commands,
}, null, 2))

console.log(`Relatorio Markdown: ${path.relative(repoRoot, outputMd).replaceAll(path.sep, '/')}`)
console.log(`Relatorio JSON: ${path.relative(repoRoot, outputJson).replaceAll(path.sep, '/')}`)
console.log(`Pasta preparada: ${path.relative(repoRoot, backupFolderPath).replaceAll(path.sep, '/')}`)
console.log(`Dump SQL pronto: ${readiness.required_ok && readiness.db_url_ok ? 'sim' : 'nao'}`)
