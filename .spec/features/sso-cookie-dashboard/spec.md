# Spec: SSO cookie dashboard

> feature: sso-cookie-dashboard
> status: pronta

## Contexto

O dashboard analítico (`dashboard.medguia.cloud`) não tem login próprio: ele lê a sessão do Hub. Hoje o Hub grava o cookie de sessão preso a `hub.medguia.cloud`, então o dashboard nunca o recebe e manda o usuário ao login do Hub com um parâmetro `retorno`. O Hub, por sua vez, manda quem já está logado para `/dashboard` e ignora o `retorno`. O resultado é um beco sem saída. Esta feature (dependência D2 do TDD do dashboard) faz o cookie valer em todo o domínio `.medguia.cloud` e faz o Hub respeitar um `retorno` seguro.

## Histórias

### US-035 — Uma única sessão vale no Hub e no dashboard

Como usuário do Hub, quero entrar uma vez e abrir o dashboard sem novo login, e, se eu abrir o dashboard sem estar logado, voltar a ele depois de entrar no Hub, para não ficar preso na tela do Hub.

#### AC-116 — O cookie de sessão vale para o domínio pai

- **Dado** a URL do Hub `https://hub.medguia.cloud` (`NEXT_PUBLIC_APP_URL`)
- **Quando** o Hub monta as opções do cookie de sessão
- **Então** o domínio do cookie é `.medguia.cloud`; para `localhost`, endereço IP, URL ausente ou inválida, nenhum domínio é definido (cookie do próprio host, como hoje)

#### AC-117 — Os três clientes do Hub usam essas opções

- **Dado** o cliente de navegador, o cliente de servidor e o proxy (middleware) do Supabase
- **Quando** cada um é criado
- **Então** os três recebem as mesmas opções de cookie (`cookieOptions`), para o cookie nunca ser gravado com escopos diferentes

#### AC-118 — Só um retorno seguro é aceito

- **Dado** um parâmetro `retorno`
- **Quando** ele é validado
- **Então** só é aceito endereço `https` cujo host seja o domínio pai do Hub ou um subdomínio dele (`dashboard.medguia.cloud`); são recusados `http`, outro domínio, `medguia.cloud.evil.com`, endereço com usuário (`https://dashboard.medguia.cloud@evil.com`), `javascript:`, caminho relativo e valor vazio

#### AC-119 — Quem já está logado vai para o retorno

- **Dado** um usuário logado que abre `/login` ou `/` com um `retorno` seguro
- **Quando** o proxy do Hub decide o destino
- **Então** ele é redirecionado ao `retorno`; sem `retorno`, ou com retorno inseguro, segue para `/dashboard` como antes

#### AC-120 — O login leva ao retorno

- **Dado** a tela de login aberta com um `retorno` seguro
- **Quando** o usuário entra com e-mail e senha corretos
- **Então** a página repassa o `retorno` à ação de login, que o valida de novo no servidor e redireciona para ele; sem `retorno` seguro vai para `/dashboard`

## Fora de escopo

- Mudar a tela de login, a troca de senha do primeiro acesso ou qualquer outra regra de autenticação.
- Aceitar `retorno` para domínios fora de `.medguia.cloud`.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-024 | O domínio do cookie sai de `NEXT_PUBLIC_APP_URL` (já é argumento de build): o domínio pai é o host sem o primeiro rótulo (`hub.medguia.cloud` → `.medguia.cloud`); assim não entra variável nova no build nem no workflow | confirmada | Decisão técnica do agente em 2026-10-02 |
| ASM-025 | Quem já está logado precisa entrar de novo uma vez, porque o cookie antigo continua preso ao host `hub.medguia.cloud` | confirmada | Aceito pelo dono do produto em 2026-10-02 (TDD 001 §6.1) |
| ASM-026 | Os outros subdomínios da VPS (supabase, evolution, obs) passam a receber o cookie; são serviços próprios e nenhum pode registrar cookies em log | confirmada | Risco já aceito no TDD 001 §6.1 |

## Perguntas em aberto

Nenhuma.
