'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, startOfHour, endOfHour } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Volume2, VolumeX, Stethoscope } from 'lucide-react'
import { getAtendimentoStatusKey } from '@/lib/atendimento-status'

export type AtendimentoPainel = {
  id: string
  data_agendamento: string
  status: string
  tipo: string | null
  chamado_em: string | null
  pacientes: { nome: string } | null
  profissional: { full_name: string | null } | null
}

let _audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!_audioCtx || _audioCtx.state === 'closed') _audioCtx = new AudioContext()
  return _audioCtx
}

function tocarChime(): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioCtx()
    if (!ctx) { resolve(); return }
    ctx.resume().then(() => {
      const notas = [523, 659, 784]
      let t = ctx.currentTime + 0.05
      notas.forEach((freq, i) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        const dur = i === notas.length - 1 ? 0.65 : 0.3
        gain.gain.setValueAtTime(0.35, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
        osc.start(t)
        osc.stop(t + dur)
        t += dur * 0.85
      })
      setTimeout(resolve, (t - ctx.currentTime + 0.25) * 1000)
    })
  })
}

// Nomes masculinos comuns em vozes PT-BR (Windows/Chrome/Edge)
const NOMES_MASCULINOS = /daniel|antonio|antônio|miguel|pedro|lucas|rafael|davi|carlos|joão|gustavo/i

function getVozMasculina(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined') return null
  const voices = window.speechSynthesis.getVoices()
  const pt = voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('pt'))
  return pt.find(v => NOMES_MASCULINOS.test(v.name)) ?? null
}

let _vozPreferida: SpeechSynthesisVoice | null = null

function criarUtterrance(texto: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(texto)
  u.lang = 'pt-BR'
  u.rate = 0.82
  u.volume = 1
  const voz = _vozPreferida ?? getVozMasculina()
  if (voz) u.voice = voz
  return u
}

function falarComChime(texto: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const anunciar = () => {
    window.speechSynthesis.cancel()
    setTimeout(() => { window.speechSynthesis.speak(criarUtterrance(texto)) }, 100)
  }
  tocarChime().then(() => {
    window.speechSynthesis.cancel()
    setTimeout(() => {
      const u1 = criarUtterrance(texto)
      u1.onend = () => setTimeout(() => tocarChime().then(anunciar), 1000)
      window.speechSynthesis.speak(u1)
    }, 100)
  })
}

function janelaAtual(): { inicio: Date; fim: Date; label: string } {
  const inicio = startOfHour(new Date())
  const fim    = endOfHour(new Date())
  return { inicio, fim, label: `${format(inicio, 'HH:mm')} – ${format(fim, 'HH:mm')}` }
}


export function PainelTV({ atendimentosIniciais }: { atendimentosIniciais: AtendimentoPainel[] }) {
  const router = useRouter()
  const [atendimentos, setAtendimentos] = useState(atendimentosIniciais)
  const [now, setNow]                   = useState(() => Date.now())
  const [hora, setHora]                 = useState('')
  const [dataLabel, setDataLabel]       = useState('')
  const [audioAtivado, setAudioAtivado] = useState(false)
  const [vozesPT, setVozesPT]           = useState<SpeechSynthesisVoice[]>([])
  const [vozIdx, setVozIdx]             = useState(0)

  const audioAtivadoRef = useRef(false)
  useEffect(() => { audioAtivadoRef.current = audioAtivado }, [audioAtivado])
  useEffect(() => { setAtendimentos(atendimentosIniciais) }, [atendimentosIniciais])

  // Carrega vozes PT disponíveis (assíncrono no browser)
  useEffect(() => {
    const carregar = () => {
      const all = window.speechSynthesis.getVoices()
      const pt  = all.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('pt'))
      if (pt.length === 0) return
      setVozesPT(pt)
      // Seleciona masculina automaticamente
      const idxM = pt.findIndex(v => NOMES_MASCULINOS.test(v.name))
      const idx  = idxM >= 0 ? idxM : 0
      setVozIdx(idx)
      _vozPreferida = pt[idx]
    }
    carregar()
    window.speechSynthesis.addEventListener('voiceschanged', carregar)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', carregar)
  }, [])

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 20_000)
    return () => clearInterval(id)
  }, [router])

  useEffect(() => {
    const tick = () => {
      const agora = new Date()
      setNow(agora.getTime())
      setHora(format(agora, 'HH:mm'))
      setDataLabel(format(agora, "EEEE, dd 'de' MMMM", { locale: ptBR }))
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('painel-tv')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'atendimentos' }, (payload) => {
        const row = payload.new as { id: string; status: string; chamado_em: string | null }
        setAtendimentos(prev =>
          prev.map(a => a.id === row.id ? { ...a, status: row.status, chamado_em: row.chamado_em } : a)
        )
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('painel-chamadas')
      .on('broadcast', { event: 'chamar' }, ({ payload }) => {
        // Atualiza imediatamente — não espera o Realtime postgres
        router.refresh()
        if (!audioAtivadoRef.current) return
        const { profissional, paciente } = payload as { profissional: string; paciente: string }
        falarComChime(`Atenção! ${profissional}. Seu paciente ${paciente} aguarda atendimento.`)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  // Takeover ativo apenas enquanto a chamada for recente (últimos 3 minutos)
  const CHAMADA_EXPIRA_MS = 30 * 1000
  const chamando = [...atendimentos]
    .filter(a => a.chamado_em && (now - new Date(a.chamado_em).getTime()) < CHAMADA_EXPIRA_MS)
    .sort((a, b) => new Date(b.chamado_em!).getTime() - new Date(a.chamado_em!).getTime())[0] ?? null

  // Próximos após o chamado atual (para os chips do takeover na Option B)
  const filaCompleta = atendimentos
    .filter(a => {
      const key = getAtendimentoStatusKey(a.status)
      return key !== 'cancelado' && key !== 'falta' && key !== 'reagendado'
    })
    .sort((a, b) => new Date(a.data_agendamento).getTime() - new Date(b.data_agendamento).getTime())

  // Último paciente chamado no dia (sem limite de tempo — para o histórico da Option A)
  const chamadosOrdenados = [...atendimentos]
    .filter(a => a.chamado_em)
    .sort((a, b) => new Date(b.chamado_em!).getTime() - new Date(a.chamado_em!).getTime())
  const ultimoChamado  = chamadosOrdenados[0] ?? null
  const ultimasChamadas = chamadosOrdenados.slice(1, 4)

  // Próximos após o chamado atual (para os chips do takeover)
  const aSeguir = filaCompleta
    .filter(a => a.id !== chamando?.id)
    .slice(0, 3)

  const trocarVoz = () => {
    if (vozesPT.length === 0) return
    const proximo = (vozIdx + 1) % vozesPT.length
    setVozIdx(proximo)
    _vozPreferida = vozesPT[proximo]
  }

  const nomeVozCurta = vozesPT[vozIdx]?.name
    .replace(/microsoft\s*/i, '')
    .replace(/online.*$/i, '')
    .replace(/natural.*/i, '')
    .trim()

  const botaoAudio = (
    <div className="fixed bottom-5 right-5 flex items-center gap-2 z-50">
      {audioAtivado && vozesPT.length > 1 && (
        <button
          onClick={trocarVoz}
          title="Trocar voz"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all shadow-sm ${
            chamando
              ? 'bg-white/15 border-white/25 text-white/70 hover:bg-white/25'
              : 'bg-surface border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          🎙 {nomeVozCurta ?? 'Voz'}
        </button>
      )}
      <button
        onClick={() => {
          const novoEstado = !audioAtivado
          setAudioAtivado(novoEstado)
          if (novoEstado) { getAudioCtx()?.resume(); tocarChime() }
        }}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all shadow-sm ${
          audioAtivado
            ? 'bg-primary-600 border-primary-600 text-white'
            : chamando
            ? 'bg-white/15 border-white/25 text-white/70 hover:bg-white/25'
            : 'bg-surface border-border text-text-secondary hover:text-text-primary'
        }`}
      >
        {audioAtivado ? <Volume2 size={13} /> : <VolumeX size={13} />}
        {audioAtivado ? 'Áudio ativo' : 'Ativar áudio'}
      </button>
    </div>
  )

  // ── OPÇÃO B: TAKEOVER quando há chamada ativa ──────────────────────────────
  if (chamando) {
    return (
      <div className="h-screen w-screen overflow-hidden select-none font-sans flex flex-col" style={{
        background: 'linear-gradient(140deg, #1AAF9A 0%, #0A8A77 100%)',
        animation: 'mg-flash 2.6s ease-in-out infinite',
      }}>
        <style>{`
          @keyframes mg-flash  { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.08)} }
          @keyframes mg-ripple { 0%{transform:scale(.55);opacity:.65} 100%{transform:scale(2.4);opacity:0} }
          @keyframes mg-bell   { 0%,100%{transform:rotate(0)} 20%{transform:rotate(12deg)} 40%{transform:rotate(-10deg)} 60%{transform:rotate(6deg)} 80%{transform:rotate(-4deg)} }
        `}</style>

        {/* Blobs */}
        <div className="absolute rounded-full pointer-events-none" style={{ top:'-9vw', right:'-8vw', width:'30vw', height:'30vw', background:'rgba(255,255,255,.08)' }} />
        <div className="absolute rounded-full pointer-events-none" style={{ bottom:'-11vw', left:'-9vw', width:'27vw', height:'27vw', background:'rgba(255,255,255,.06)' }} />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between" style={{ padding: '3.4vh 3vw' }}>
          <div className="flex items-center" style={{ gap: '1.1vw' }}>
            <div className="shrink-0 flex items-center justify-center" style={{
              width:'max(3.4vw,50px)', height:'max(3.4vw,50px)', borderRadius:14,
              background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.3)',
            }}>
              <Stethoscope style={{ width:'52%', height:'52%' }} className="text-white" />
            </div>
            <div style={{ lineHeight: 1.15 }}>
              <p className="font-bold text-white m-0" style={{ fontSize:'max(1.4vw,17px)' }}>MedGuia Hub</p>
              <p className="font-semibold text-white/70 m-0 uppercase" style={{ fontSize:'max(0.9vw,11px)', letterSpacing:'2px' }}>Painel de Chamadas</p>
            </div>
          </div>
          <span className="font-bold tabular-nums text-white" style={{ fontSize:'max(2.4vw,26px)', letterSpacing:'-1px' }}>{hora}</span>
        </header>

        {/* Centro */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center" style={{ padding: '0 5vw' }}>

          {/* Sino com ripples */}
          <div className="relative flex items-center justify-center" style={{ marginBottom: '2.6vh' }}>
            <span className="absolute rounded-full" style={{
              width:'max(8.5vw,120px)', height:'max(8.5vw,120px)',
              border:'2px solid rgba(255,255,255,.6)',
              animation:'mg-ripple 2.2s ease-out infinite',
            }} />
            <span className="absolute rounded-full" style={{
              width:'max(8.5vw,120px)', height:'max(8.5vw,120px)',
              border:'2px solid rgba(255,255,255,.6)',
              animation:'mg-ripple 2.2s ease-out infinite',
              animationDelay:'1.1s',
            }} />
            <div className="flex items-center justify-center rounded-full" style={{
              width:'max(6.8vw,96px)', height:'max(6.8vw,96px)',
              background:'rgba(255,255,255,.16)', border:'1px solid rgba(255,255,255,.25)',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ width:'48%', height:'48%', animation:'mg-bell 2.4s ease-in-out infinite', transformOrigin:'50% 20%' }}>
                <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
              </svg>
            </div>
          </div>

          {/* Eyebrow */}
          <p className="font-bold text-white/90 m-0" style={{ fontSize:'max(1.8vw,16px)', letterSpacing:'6px', marginBottom:'2.6vh' }}>
            PACIENTE CHEGOU
          </p>

          {/* Nome do paciente */}
          <h1 className="font-extrabold text-white m-0" style={{ fontSize:'max(7.4vw,42px)', lineHeight:1, letterSpacing:'-2.5px', marginBottom:'4vh' }}>
            {(chamando.pacientes?.nome ?? '—').toUpperCase()}
          </h1>

          {/* Pill do profissional */}
          <div className="inline-flex items-center" style={{
            gap:'1.2vw', background:'rgba(255,255,255,.16)', border:'1px solid rgba(255,255,255,.28)',
            padding:'1.5vh 2.4vw', borderRadius:999,
          }}>
            <span className="font-bold text-white/82 uppercase" style={{ fontSize:'max(1.3vw,13px)', letterSpacing:'3px' }}>
              PROFISSIONAL
            </span>
            <span className="rounded-full" style={{ width:6, height:6, background:'rgba(255,255,255,.6)', flexShrink:0 }} />
            <span className="font-bold text-white" style={{ fontSize:'max(2.3vw,20px)' }}>
              {chamando.profissional?.full_name ?? '—'}
            </span>
          </div>
        </div>

        {/* Footer — A seguir */}
        {aSeguir.length > 0 && (
          <footer className="relative z-10 flex items-center" style={{ gap:'1.4vw', padding:'2.6vh 3vw', background:'rgba(0,0,0,.12)' }}>
            <span className="font-bold text-white/70 whitespace-nowrap" style={{ fontSize:'max(1.15vw,12px)', letterSpacing:'3px' }}>
              A SEGUIR
            </span>
            <div className="flex flex-1 min-w-0" style={{ gap:'0.9vw' }}>
              {aSeguir.map(a => (
                <span key={a.id} className="flex-1 font-semibold text-white truncate" style={{
                  background:'rgba(255,255,255,.14)', borderRadius:10,
                  padding:'1.4vh 1.4vw', fontSize:'max(1.3vw,13px)',
                }}>
                  {a.pacientes?.nome ?? '—'}
                </span>
              ))}
            </div>
          </footer>
        )}

        {botaoAudio}
      </div>
    )
  }

  // ── OPÇÃO A: layout padrão quando ninguém está sendo chamado ───────────────
  return (
    <div className="h-screen w-screen bg-page flex flex-col overflow-hidden select-none font-sans">
      <style>{`
        @keyframes mg-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.35; transform:scale(.85); }
        }
        .mg-dot { animation: mg-pulse 1.4s ease-in-out infinite; }
      `}</style>

      {/* HEADER */}
      <header className="bg-surface border-b border-border flex items-center justify-between shrink-0"
        style={{ height:'11vh', minHeight:90, padding:'0 2.6vw' }}>
        <div className="flex items-center" style={{ gap:'1.1vw' }}>
          <div className="shrink-0 flex items-center justify-center" style={{
            width:'max(3.6vw,52px)', height:'max(3.6vw,52px)', borderRadius:14,
            background:'linear-gradient(135deg,#1AAF9A,#0A8A77)',
            boxShadow:'0 4px 16px rgba(15,158,137,.32)',
          }}>
            <Stethoscope style={{ width:'52%', height:'52%' }} className="text-white" />
          </div>
          <div style={{ lineHeight:1.15 }}>
            <p className="font-bold text-text-primary m-0" style={{ fontSize:'max(1.5vw,18px)' }}>MedGuia Hub</p>
            <p className="font-bold text-text-tertiary uppercase m-0" style={{ fontSize:'max(0.85vw,11px)', letterSpacing:'2px' }}>Painel de Chamadas</p>
          </div>
        </div>
        <div className="flex flex-col items-end" style={{ lineHeight:1.05 }}>
          <span className="font-bold tabular-nums text-text-primary" style={{ fontSize:'max(2.9vw,30px)', letterSpacing:'-1px' }}>{hora}</span>
          <span className="font-semibold text-text-tertiary capitalize" style={{ fontSize:'max(1vw,12px)' }}>{dataLabel}</span>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 min-h-0">

        {/* HERO — largura total */}
        <section className="relative flex flex-col justify-center overflow-hidden w-full"
          style={{ padding:'0 8vw', background:'linear-gradient(140deg,#1AAF9A 0%,#0A8A77 100%)' }}>
          <div className="absolute rounded-full pointer-events-none" style={{ top:'-7vw', right:'-7vw', width:'24vw', height:'24vw', background:'rgba(255,255,255,.08)' }} />
          <div className="absolute rounded-full pointer-events-none" style={{ bottom:'-5vw', left:'-4vw', width:'16vw', height:'16vw', background:'rgba(255,255,255,.06)' }} />

          <div className="relative">
            {ultimoChamado ? (
              <>
                <div className="flex items-center" style={{ gap:'1vw', marginBottom:'2.4vh' }}>
                  <span className="rounded-full shrink-0" style={{ width:'max(1.1vw,14px)', height:'max(1.1vw,14px)', background:'rgba(255,255,255,.35)' }} />
                  <span className="font-bold" style={{ fontSize:'max(1.7vw,15px)', letterSpacing:'4px', color:'rgba(255,255,255,.55)' }}>
                    ÚLTIMO CHAMADO
                  </span>
                </div>
                <h1 className="font-extrabold m-0" style={{ fontSize:'max(5.6vw,38px)', lineHeight:1.02, letterSpacing:'-1.5px', color:'rgba(255,255,255,.35)' }}>
                  {(ultimoChamado.pacientes?.nome ?? '—').toUpperCase()}
                </h1>
                <div className="rounded-full" style={{ width:'5.5vw', height:4, background:'rgba(255,255,255,.2)', margin:'3.8vh 0 2.4vh' }} />
                <p className="font-bold m-0" style={{ fontSize:'max(1.3vw,13px)', letterSpacing:'3px', color:'rgba(255,255,255,.4)', marginBottom:'0.8vh' }}>
                  PROFISSIONAL
                </p>
                <p className="font-bold m-0" style={{ fontSize:'max(2.9vw,22px)', color:'rgba(255,255,255,.35)' }}>
                  {ultimoChamado.profissional?.full_name ?? '—'}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center" style={{ gap:'1vw', marginBottom:'2.4vh' }}>
                  <span className="rounded-full shrink-0" style={{ width:'max(1.1vw,14px)', height:'max(1.1vw,14px)', background:'rgba(255,255,255,.3)' }} />
                  <span className="font-bold" style={{ fontSize:'max(1.7vw,15px)', letterSpacing:'4px', color:'rgba(255,255,255,.5)' }}>
                    AGUARDANDO CHAMADA
                  </span>
                </div>
                <h1 className="font-extrabold m-0" style={{ fontSize:'max(3.6vw,28px)', color:'rgba(255,255,255,.2)', letterSpacing:'-1px' }}>
                  Nenhum paciente<br />sendo chamado
                </h1>
              </>
            )}
          </div>

          {/* Últimas chamadas */}
          {ultimasChamadas.length > 0 && (
            <div className="relative shrink-0" style={{ borderTop:'1px solid rgba(255,255,255,.15)', padding:'2.4vh 0 0' }}>
              <p className="font-bold m-0" style={{ fontSize:'max(0.9vw,11px)', letterSpacing:'3px', color:'rgba(255,255,255,.45)', marginBottom:'1.6vh' }}>
                CHAMADAS ANTERIORES
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:'1.2vh' }}>
                {ultimasChamadas.map(a => (
                  <div key={a.id} className="flex items-center" style={{ gap:'1.2vw' }}>
                    <span className="tabular-nums font-semibold shrink-0" style={{ fontSize:'max(1.1vw,12px)', color:'rgba(255,255,255,.35)', minWidth:'3.5vw' }}>
                      {format(new Date(a.chamado_em!), 'HH:mm')}
                    </span>
                    <span className="font-semibold truncate" style={{ fontSize:'max(1.3vw,13px)', color:'rgba(255,255,255,.45)' }}>
                      {a.pacientes?.nome ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {botaoAudio}
    </div>
  )
}
