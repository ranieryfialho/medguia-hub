/**
 * Valida o parâmetro `retorno` do login (spec sso-cookie-dashboard, AC-118).
 *
 * Só volta a endereço `https` cujo host seja o domínio pai do Hub ou um
 * subdomínio dele (`dashboard.medguia.cloud`). Qualquer outra coisa devolve
 * `null`, para o `retorno` nunca virar redirecionamento aberto.
 */
import { dominioPaiDoHub } from './dominio-cookie.ts'

export function destinoRetornoSeguro(
  retorno: string | null | undefined,
  appUrl: string | undefined | null = process.env.NEXT_PUBLIC_APP_URL,
): string | null {
  if (!retorno) return null
  const dominio = dominioPaiDoHub(appUrl)
  if (!dominio) return null

  let url: URL
  try {
    url = new URL(retorno)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null
  if (url.username || url.password) return null

  const host = url.hostname
  if (host !== dominio.slice(1) && !host.endsWith(dominio)) return null

  return url.toString()
}
