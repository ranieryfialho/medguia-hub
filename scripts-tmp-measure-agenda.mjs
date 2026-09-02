import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  if (!m) throw new Error(`missing ${key}`)
  return m[1].trim()
}

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const APP_UTC_OFFSET = '-03:00'
function dayRange(date) {
  return {
    start: new Date(`${date}T00:00:00${APP_UTC_OFFSET}`).toISOString(),
    end: new Date(`${date}T23:59:59.999${APP_UTC_OFFSET}`).toISOString(),
  }
}
function weekRange(dateKey) {
  const d = new Date(`${dateKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  const start = d.toISOString().slice(0, 10)
  const e = new Date(`${dateKey}T00:00:00Z`)
  e.setUTCDate(e.getUTCDate() + (6 - e.getUTCDay()))
  const end = e.toISOString().slice(0, 10)
  return { start, end }
}
function monthRange(dateKey) {
  const [y, m] = dateKey.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { start, end }
}

const REF_DATE = process.argv[2] || '2026-09-02'

async function findFullestDay() {
  // reproduz o levantamento do baseline: dia com mais agendamentos nos ultimos 60 + proximos 14 dias
  const base = new Date(`${REF_DATE}T12:00:00${APP_UTC_OFFSET}`)
  const from = new Date(base)
  from.setUTCDate(from.getUTCDate() - 60)
  const to = new Date(base)
  to.setUTCDate(to.getUTCDate() + 14)
  const { start } = dayRange(from.toISOString().slice(0, 10))
  const { end } = dayRange(to.toISOString().slice(0, 10))
  const { data, error } = await supabase
    .from('atendimentos')
    .select('data_agendamento')
    .gte('data_agendamento', start)
    .lte('data_agendamento', end)
  if (error) throw error
  const counts = new Map()
  for (const row of data) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date(row.data_agendamento))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best = null
  for (const [k, v] of counts) {
    if (!best || v > best.count) best = { date: k, count: v }
  }
  return best
}

async function timeQuery(label, fn, runs = 5) {
  const times = []
  let rowCount = null
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    const { data, error } = await fn()
    const t1 = performance.now()
    if (error) throw error
    rowCount = data?.length ?? 0
    times.push(Math.round(t1 - t0))
  }
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
  console.log(`${label} | linhas=${rowCount} | tempos=${times.join(', ')} | media=${avg}ms`)
  return { label, rowCount, times, avg }
}

const SELECT_LEVE = `
  id,
  paciente_id,
  profissional_id,
  fisioterapeuta_id,
  agendamento_id,
  data_agendamento,
  status,
  tipo,
  observacoes,
  numero_sessao,
  total_sessoes,
  marcou_retorno,
  aguardando_desde,
  em_atendimento_desde,
  agendamento_pai:agendamentos(plano_saude, tipo),
  pacientes (nome, foto_drive_file_id, foto_atualizada_em),
  profissional:profiles!profissional_id(full_name),
  fisioterapeuta_executor:profiles!fisioterapeuta_id(full_name)
`

async function main() {
  console.log(`Dia de referência solicitado: ${REF_DATE}`)
  const fullest = await findFullestDay()
  console.log(`Dia mais cheio no levantamento (60d atrás + 14d à frente): ${fullest?.date} (${fullest?.count} atendimentos)\n`)

  const refDate = fullest?.date || REF_DATE
  const { start: diaStart, end: diaEnd } = dayRange(refDate)
  const { start: semStartKey, end: semEndKey } = weekRange(refDate)
  const { start: semStart } = dayRange(semStartKey)
  const { end: semEnd } = dayRange(semEndKey)
  const { start: mesStartKey, end: mesEndKey } = monthRange(refDate)
  const { start: mesStart } = dayRange(mesStartKey)
  const { end: mesEnd } = dayRange(mesEndKey)

  const results = []

  results.push(await timeQuery('Query leve (com foto_drive_file_id/foto_atualizada_em) | dia', () =>
    supabase.from('atendimentos').select(SELECT_LEVE).gte('data_agendamento', diaStart).lte('data_agendamento', diaEnd).order('data_agendamento', { ascending: true })
  ))

  results.push(await timeQuery('Query leve (com foto_drive_file_id/foto_atualizada_em) | semana', () =>
    supabase.from('atendimentos').select(SELECT_LEVE).gte('data_agendamento', semStart).lte('data_agendamento', semEnd).order('data_agendamento', { ascending: true })
  ))

  results.push(await timeQuery('Query leve (id, data_agendamento, status) | mês', () =>
    supabase.from('atendimentos').select('id, data_agendamento, status').gte('data_agendamento', mesStart).lte('data_agendamento', mesEnd).order('data_agendamento', { ascending: true })
  ))

  results.push(await timeQuery('Calendário mensal (data_agendamento, status) | dia/semana/mês', () =>
    supabase.from('atendimentos').select('data_agendamento, status').gte('data_agendamento', mesStart).lte('data_agendamento', mesEnd)
  ))

  console.log('\nResumo JSON:')
  console.log(JSON.stringify({ refDate, results: results.map(r => ({ label: r.label, rowCount: r.rowCount, avg: r.avg })) }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
