/**
 * Domínio do cookie de sessão compartilhado entre o Hub e o dashboard
 * (spec sso-cookie-dashboard, AC-116).
 *
 * O domínio sai de `NEXT_PUBLIC_APP_URL` (já é argumento de build): o host sem
 * o primeiro rótulo, com ponto na frente (`hub.medguia.cloud` → `.medguia.cloud`).
 * Em `localhost`, IP, URL ausente ou inválida não há domínio — o cookie fica no
 * próprio host, como antes.
 */
export function dominioPaiDoHub(appUrl: string | undefined | null): string | null {
  if (!appUrl) return null
  let host: string
  try {
    host = new URL(appUrl).hostname
  } catch {
    return null
  }
  if (!host || host === 'localhost' || host.includes(':') || /^\d+(\.\d+){3}$/.test(host)) return null
  const rotulos = host.split('.')
  if (rotulos.length < 3) return null
  return `.${rotulos.slice(1).join('.')}`
}

export function opcoesCookieSessao(
  appUrl: string | undefined | null = process.env.NEXT_PUBLIC_APP_URL,
): { domain?: string } {
  const domain = dominioPaiDoHub(appUrl)
  return domain ? { domain } : {}
}
