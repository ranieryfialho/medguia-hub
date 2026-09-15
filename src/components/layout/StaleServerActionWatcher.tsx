'use client'

import { useEffect } from 'react'
import toast from 'react-hot-toast'

const RELOAD_GUARD_KEY = 'mg_stale_action_reload_at'
const RELOAD_GUARD_WINDOW_MS = 15_000
const BUILD_ID_POLL_MS = 5 * 60_000
const BUILD_ID_ATUAL = process.env.NEXT_PUBLIC_BUILD_ID

function isStaleServerActionError(message: unknown): boolean {
  if (typeof message !== 'string') return false
  return message.includes('Server Action') && message.includes('was not found on the server')
}

/**
 * Após cada deploy o Next.js gera novos IDs de Server Action. Quem já estava
 * com a aba aberta mantém o JS antigo em memória e toda chamada de action
 * passa a responder 404 ("was not found on the server") até um reload
 * manual — isso afeta qualquer uma das dezenas de Server Actions do app,
 * não só uma tela específica.
 *
 * Toda Server Action chamada pelo client vai por um `fetch` com o header
 * `Next-Action`. Interceptamos esse fetch aqui: se a resposta indicar que a
 * action não existe mais no servidor, recarregamos a página automaticamente
 * ANTES do erro chegar ao código da aplicação — corrigindo o problema para
 * qualquer tela, sem precisar tratar cada Server Action individualmente.
 * Mantemos também um listener de unhandledrejection/error como rede de
 * segurança para o caso (raro) de algum trecho não capturado.
 */
export function StaleServerActionWatcher() {
  useEffect(() => {
    function forceReload() {
      let podeRecarregar = true
      try {
        const ultimoReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? '0')
        podeRecarregar = Date.now() - ultimoReload > RELOAD_GUARD_WINDOW_MS
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
      } catch {
        // sessionStorage indisponível (modo privado etc.) — segue com o reload
      }
      if (podeRecarregar) {
        toast('Sistema atualizado. Recarregando a página...', { icon: 'ℹ️', duration: 3000 })
        window.setTimeout(() => window.location.reload(), 400)
      }
    }

    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      try {
        const isServerActionRequest =
          args[1] &&
          typeof args[1] === 'object' &&
          'headers' in args[1] &&
          new Headers(args[1].headers as HeadersInit).has('Next-Action')
        if (isServerActionRequest && response.status === 404) {
          forceReload()
        }
      } catch {
        // ignora falha ao inspecionar a requisição — não deve quebrar o fetch original
      }
      return response
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      const message = reason instanceof Error ? reason.message : reason
      if (isStaleServerActionError(message)) {
        forceReload()
      }
    }

    function handleError(event: ErrorEvent) {
      if (isStaleServerActionError(event.message) || isStaleServerActionError(event.error?.message)) {
        forceReload()
      }
    }

    window.addEventListener('unhandledrejection', handleRejection)
    window.addEventListener('error', handleError)
    return () => {
      window.fetch = originalFetch
      window.removeEventListener('unhandledrejection', handleRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])

  // Checagem proativa: em vez de esperar uma Server Action falhar, pergunta
  // periodicamente ao servidor qual é o BUILD_ID em execução (rota
  // /api/build-id) e compara com o BUILD_ID embutido neste bundle. Se
  // divergir, há uma build nova no ar. Recarrega na hora se a aba estiver em
  // segundo plano (não interrompe ninguém); se estiver em uso, avisa com um
  // toast e só recarrega quando a aba for para segundo plano ou voltar do
  // segundo plano — nunca no meio de uma interação ativa.
  useEffect(() => {
    if (!BUILD_ID_ATUAL) return

    let updateDisponivel = false
    let avisoMostrado = false

    async function checarBuildId() {
      try {
        const res = await fetch('/api/build-id', { cache: 'no-store' })
        if (!res.ok) return
        const data: { buildId: string | null } = await res.json()
        if (data.buildId && data.buildId !== BUILD_ID_ATUAL) {
          updateDisponivel = true
          if (document.hidden) {
            window.location.reload()
            return
          }
          if (!avisoMostrado) {
            avisoMostrado = true
            toast('Uma nova versão do sistema está disponível. Ela será aplicada assim que você trocar de aba.', {
              icon: '🔄',
              duration: 8000,
            })
          }
        }
      } catch {
        // rede instável — tenta de novo no próximo ciclo
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        if (updateDisponivel) window.location.reload()
        return
      }
      void checarBuildId()
    }

    void checarBuildId()
    const intervalId = window.setInterval(checarBuildId, BUILD_ID_POLL_MS)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return null
}
