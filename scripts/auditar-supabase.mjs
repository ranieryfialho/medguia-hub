import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const sourceRoots = ['src']
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const outputDir = path.join(repoRoot, 'docs')
const outputJson = path.join(outputDir, 'auditoria-supabase.json')
const outputMd = path.join(outputDir, 'AUDITORIA_SUPABASE.md')

const featureChecks = [
  {
    key: 'server_client',
    label: 'Server client Supabase',
    patterns: ["@/lib/supabase/server", '@supabase/ssr'],
  },
  {
    key: 'browser_client',
    label: 'Browser client Supabase',
    patterns: ["@/lib/supabase/client", 'createBrowserClient('],
  },
  {
    key: 'auth',
    label: 'Auth Supabase',
    patterns: [
      'supabase.auth.',
      '.auth.getUser(',
      '.auth.getSession(',
      '.signInWithPassword(',
      '.updateUser(',
      '.signOut(',
      '.onAuthStateChange(',
    ],
  },
  {
    key: 'auth_admin',
    label: 'Admin Auth / service role',
    patterns: [
      '.auth.admin.',
      'SUPABASE_SERVICE_ROLE_KEY',
      'createSupabaseAdminClient',
    ],
  },
  {
    key: 'storage',
    label: 'Storage Supabase',
    patterns: [
      'supabase.storage',
      '.storage.',
      "from('storage",
      'storage.',
    ],
  },
  {
    key: 'realtime',
    label: 'Realtime Supabase',
    patterns: [
      '.realtime.',
      '.channel(',
      '.removeChannel(',
      '.setAuth(',
    ],
  },
  {
    key: 'rpc',
    label: 'RPC SQL',
    patterns: ['.rpc('],
  },
  {
    key: 'middleware',
    label: 'Middleware de sessao',
    patterns: ['updateSession(', '@/lib/supabase/middleware'],
  },
]

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
      continue
    }
    if (allowedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

function toRepoPath(absPath) {
  return path.relative(repoRoot, absPath).replaceAll(path.sep, '/')
}

function countOccurrences(content, pattern) {
  return content.split(pattern).length - 1
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function quote(value) {
  return `\`${value}\``
}

const files = sourceRoots
  .map((root) => path.join(repoRoot, root))
  .filter((root) => fs.existsSync(root))
  .flatMap((root) => walk(root))

const summary = {
  scanned_at: new Date().toISOString(),
  total_files: files.length,
  files_with_supabase: 0,
  features: Object.fromEntries(featureChecks.map((item) => [item.key, {
    label: item.label,
    files: [],
    hits: 0,
  }])),
  table_usage: {},
  rpc_usage: {},
}

const supabaseFiles = []

for (const absPath of files) {
  const content = fs.readFileSync(absPath, 'utf8')
  const repoPath = toRepoPath(absPath)
  let fileHasSupabase = false

  for (const feature of featureChecks) {
    let featureHits = 0
    for (const pattern of feature.patterns) {
      featureHits += countOccurrences(content, pattern)
    }

    if (featureHits > 0) {
      fileHasSupabase = true
      summary.features[feature.key].files.push(repoPath)
      summary.features[feature.key].hits += featureHits
    }
  }

  const fromMatches = content.matchAll(/\.from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)
  for (const match of fromMatches) {
    const table = match[1]
    summary.table_usage[table] ??= { hits: 0, files: new Set() }
    summary.table_usage[table].hits += 1
    summary.table_usage[table].files.add(repoPath)
    fileHasSupabase = true
  }

  const rpcMatches = content.matchAll(/\.rpc\(\s*['"`]([^'"`]+)['"`]\s*/g)
  for (const match of rpcMatches) {
    const rpcName = match[1]
    summary.rpc_usage[rpcName] ??= { hits: 0, files: new Set() }
    summary.rpc_usage[rpcName].hits += 1
    summary.rpc_usage[rpcName].files.add(repoPath)
    fileHasSupabase = true
  }

  if (fileHasSupabase) {
    supabaseFiles.push(repoPath)
  }
}

summary.files_with_supabase = supabaseFiles.length

for (const feature of Object.values(summary.features)) {
  feature.files.sort()
}

const tableEntries = Object.entries(summary.table_usage)
  .map(([table, info]) => ({
    table,
    hits: info.hits,
    files: [...info.files].sort(),
  }))
  .sort((a, b) => b.hits - a.hits || a.table.localeCompare(b.table, 'pt-BR'))

const rpcEntries = Object.entries(summary.rpc_usage)
  .map(([rpc, info]) => ({
    rpc,
    hits: info.hits,
    files: [...info.files].sort(),
  }))
  .sort((a, b) => b.hits - a.hits || a.rpc.localeCompare(b.rpc, 'pt-BR'))

const topTables = tableEntries.slice(0, 20)
const criticalFindings = [
  summary.features.auth.hits > 0 ? '- Existe uso de autenticacao Supabase no codigo.' : null,
  summary.features.auth_admin.hits > 0 ? '- Existe uso de `auth.admin` / service role.' : null,
  summary.features.realtime.hits > 0 ? '- Existe uso de Realtime, o que exige estrategia especifica na migracao.' : null,
  summary.features.storage.hits > 0 ? '- Existe indicio de uso de Storage Supabase.' : null,
  summary.features.rpc.hits > 0 ? '- Existem chamadas RPC SQL que precisam ser preservadas no destino.' : null,
].filter(Boolean)

const markdown = [
  '# Auditoria de Dependencias do Supabase',
  '',
  `Gerado em: ${summary.scanned_at}`,
  '',
  '## Resumo',
  '',
  `- Arquivos analisados: ${summary.total_files}`,
  `- Arquivos com indicios de uso do Supabase: ${summary.files_with_supabase}`,
  '',
  '## Achados Criticos',
  '',
  ...(criticalFindings.length > 0 ? criticalFindings : ['- Nenhum achado critico detectado pelo scanner textual.']),
  '',
  '## Uso por Categoria',
  '',
  ...Object.values(summary.features).map((feature) =>
    `- ${feature.label}: ${feature.files.length} arquivo(s), ${feature.hits} ocorrencia(s)`
  ),
  '',
  '## Tabelas Mais Referenciadas',
  '',
  ...(
    topTables.length > 0
      ? topTables.map((entry) => `- ${quote(entry.table)}: ${entry.hits} referencia(s) em ${entry.files.length} arquivo(s)`)
      : ['- Nenhuma chamada `.from(...)` encontrada.']
  ),
  '',
  '## RPCs Encontradas',
  '',
  ...(
    rpcEntries.length > 0
      ? rpcEntries.map((entry) => `- ${quote(entry.rpc)}: ${entry.hits} referencia(s) em ${entry.files.length} arquivo(s)`)
      : ['- Nenhuma chamada `.rpc(...)` encontrada.']
  ),
  '',
  '## Arquivos por Categoria',
  '',
]

for (const feature of Object.values(summary.features)) {
  markdown.push(`### ${feature.label}`)
  markdown.push('')
  if (feature.files.length === 0) {
    markdown.push('- Nenhum arquivo encontrado.')
    markdown.push('')
    continue
  }
  for (const file of feature.files) {
    markdown.push(`- ${quote(file)}`)
  }
  markdown.push('')
}

markdown.push('## Proximos Passos Sugeridos')
markdown.push('')
markdown.push('- Validar manualmente os arquivos marcados em `Auth Supabase`.')
markdown.push('- Validar se `auth.admin` precisa ser mantido ou substituido.')
markdown.push('- Levantar estrategia para Realtime, se permanecer necessario.')
markdown.push('- Revisar tabelas e RPCs mais referenciadas antes do plano de cutover.')
markdown.push('- Mapear se existe uso real de Storage; o scanner textual pode sinalizar falso positivo.')
markdown.push('')

ensureDir(outputDir)
fs.writeFileSync(outputMd, markdown.join('\n'))
fs.writeFileSync(outputJson, JSON.stringify({
  ...summary,
  table_usage: tableEntries,
  rpc_usage: rpcEntries,
}, null, 2))

console.log(`Relatorio Markdown: ${toRepoPath(outputMd)}`)
console.log(`Relatorio JSON: ${toRepoPath(outputJson)}`)
console.log(`Arquivos com Supabase: ${summary.files_with_supabase}`)
console.log(`Auth hits: ${summary.features.auth.hits}`)
console.log(`Admin auth hits: ${summary.features.auth_admin.hits}`)
console.log(`Realtime hits: ${summary.features.realtime.hits}`)
console.log(`Storage hits: ${summary.features.storage.hits}`)
console.log(`RPC hits: ${summary.features.rpc.hits}`)
