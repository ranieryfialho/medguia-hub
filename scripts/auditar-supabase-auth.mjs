import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const srcRoot = path.join(repoRoot, 'src')
const outputDir = path.join(repoRoot, 'docs')
const outputMd = path.join(outputDir, 'AUDITORIA_SUPABASE_AUTH.md')
const outputJson = path.join(outputDir, 'auditoria-supabase-auth.json')
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

const authPatterns = [
  { key: 'get_user', label: 'Leitura de usuario logado', patterns: ['.auth.getUser('] },
  { key: 'get_session', label: 'Leitura de sessao', patterns: ['.auth.getSession('] },
  { key: 'sign_in_password', label: 'Login por senha', patterns: ['.auth.signInWithPassword('] },
  { key: 'sign_out', label: 'Logout', patterns: ['.auth.signOut('] },
  { key: 'update_user', label: 'Atualizacao de usuario autenticado', patterns: ['.auth.updateUser('] },
  { key: 'auth_listener', label: 'Listener de auth', patterns: ['.auth.onAuthStateChange('] },
  { key: 'admin_update_user', label: 'Admin update user', patterns: ['.auth.admin.updateUserById('] },
  { key: 'service_role', label: 'Service role key', patterns: ['SUPABASE_SERVICE_ROLE_KEY'] },
  { key: 'middleware_session', label: 'Middleware / sessao', patterns: ['updateSession(', '@/lib/supabase/middleware'] },
]

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
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

function quote(value) {
  return `\`${value}\``
}

const files = fs.existsSync(srcRoot) ? walk(srcRoot) : []
const results = Object.fromEntries(authPatterns.map((item) => [item.key, {
  label: item.label,
  hits: 0,
  files: [],
}]))

for (const absPath of files) {
  const repoPath = toRepoPath(absPath)
  const content = fs.readFileSync(absPath, 'utf8')

  for (const patternGroup of authPatterns) {
    let hits = 0
    for (const pattern of patternGroup.patterns) {
      hits += countOccurrences(content, pattern)
    }
    if (hits > 0) {
      results[patternGroup.key].hits += hits
      results[patternGroup.key].files.push({
        path: repoPath,
        hits,
      })
    }
  }
}

for (const item of Object.values(results)) {
  item.files.sort((a, b) => b.hits - a.hits || a.path.localeCompare(b.path, 'pt-BR'))
}

const arquivosAuth = new Set(
  Object.values(results)
    .flatMap((item) => item.files.map((file) => file.path))
)

const criticalFiles = [...arquivosAuth]
  .filter((file) =>
    file.includes('src/actions/auth.ts') ||
    file.includes('src/lib/supabase/middleware.ts') ||
    file.includes('src/lib/guard.ts') ||
    file.includes('src/actions/acessos.ts') ||
    file.includes('src/actions/equipe.ts') ||
    file.includes('src/proxy.ts')
  )
  .sort()

const markdown = [
  '# Auditoria Supabase Auth',
  '',
  `Gerado em: ${new Date().toISOString()}`,
  '',
  '## Resumo',
  '',
  `- Arquivos analisados: ${files.length}`,
  `- Arquivos com dependencia de auth: ${arquivosAuth.size}`,
  `- Ocorrencias de service role: ${results.service_role.hits}`,
  `- Ocorrencias de admin auth: ${results.admin_update_user.hits}`,
  '',
  '## Ponto de Atencao',
  '',
  '- Esse relatorio foca apenas em autenticacao e sessao.',
  '- Qualquer migracao para Postgres puro exigira substituicao dessas integracoes.',
  '',
  '## Areas Criticas',
  '',
  ...(criticalFiles.length > 0
    ? criticalFiles.map((file) => `- ${quote(file)}`)
    : ['- Nenhum arquivo critico identificado pelo scanner.']),
  '',
  '## Uso por Operacao',
  '',
]

for (const [key, item] of Object.entries(results)) {
  markdown.push(`### ${item.label}`)
  markdown.push('')
  markdown.push(`- Chave interna: ${quote(key)}`)
  markdown.push(`- Ocorrencias: ${item.hits}`)
  markdown.push(`- Arquivos: ${item.files.length}`)
  if (item.files.length > 0) {
    for (const file of item.files) {
      markdown.push(`- ${quote(file.path)}: ${file.hits}`)
    }
  } else {
    markdown.push('- Nenhum arquivo encontrado.')
  }
  markdown.push('')
}

markdown.push('## Proximos Passos Sugeridos')
markdown.push('')
markdown.push('- Definir o substituto para login, sessao e reset de senha antes da migracao.')
markdown.push('- Revisar os fluxos em `actions/auth`, `guard`, `middleware` e `proxy`.')
markdown.push('- Mapear se `auth.admin.updateUserById` sera substituido por painel administrativo proprio ou outro provider.')
markdown.push('- Separar o que e autenticacao do que e autorizacao por `profiles` e `modulos_liberados`.')
markdown.push('')

ensureDir(outputDir)
fs.writeFileSync(outputMd, markdown.join('\n'))
fs.writeFileSync(outputJson, JSON.stringify({
  generated_at: new Date().toISOString(),
  scanned_files: files.length,
  auth_files: [...arquivosAuth].sort(),
  results,
  critical_files: criticalFiles,
}, null, 2))

console.log(`Relatorio Markdown: ${toRepoPath(outputMd)}`)
console.log(`Relatorio JSON: ${toRepoPath(outputJson)}`)
console.log(`Arquivos com auth: ${arquivosAuth.size}`)
console.log(`Admin auth hits: ${results.admin_update_user.hits}`)
console.log(`Service role hits: ${results.service_role.hits}`)
