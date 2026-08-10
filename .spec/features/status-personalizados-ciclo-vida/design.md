# Design — Ciclo de vida dos status personalizados

> feature: status-personalizados-ciclo-vida

## Princípio que organiza tudo: decisão fora do SQL e fora do JSX

O ambiente não executa Postgres (sem Docker/psql) nem renderiza React nos testes (`node --test` não transforma JSX). Em vez de aceitar que a maior parte da feature fique sem prova, o desenho **empurra toda regra decidível para funções puras em TypeScript**, deixando SQL e componentes como cascas finas.

Isso não é contorção para satisfazer o motor — é o mesmo movimento que torna a regra legível e mudável. Onde a decisão não pode sair do SQL (gatilho, cron), a prova é uma **asserção estática sobre o texto da migration**, que garante forma e ordem, não comportamento.

## Camadas

```
┌─────────────────────────────────────────────────────────┐
│ CASCA (sem teste)                                       │
│   WidgetDisponibilidade · CardStatusEquipe · páginas    │
│   Só renderizam o que a camada de regras devolve        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ REGRAS PURAS (teste de comportamento — node --test)     │
│   status-disponibilidade-regras.ts                      │
│   status-card-agenda.ts                                 │
│   relatorios/inclusao-profissional.ts                   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ SQL (asserção estática sobre o arquivo .sql)            │
│   4 migrations independentes                            │
└─────────────────────────────────────────────────────────┘
```

## Módulos de regra

### `src/lib/status-disponibilidade-regras.ts`

| Função | Responde | Critérios |
|---|---|---|
| `validarObservacao(opcao, texto)` | a troca de status pode prosseguir? | AC-001, AC-002 |
| `ehStatusPersonalizado(opcao)` | é declarado pelo profissional ou derivado do sistema? | AC-011 |
| `opcoesSelecionaveis(opcoes)` | o que aparece em "Meu status" | AC-011 |
| `podeEditarOpcao(opcao)` | o gestor pode mexer neste status? | AC-012 |
| `blocoVencido(inicio, agora, tetoMin)` | o bloco passou do teto de 1h? | AC-007 |

`opcoesSelecionaveis` hoje vive inline no widget como `filter(o => !o.sistema || o.slug === 'disponivel')`. Extrair torna testável o efeito de `ocupado` virar status de sistema — que é exatamente o defeito que a feature corrige.

### `src/lib/status-card-agenda.ts`

`montarCardsStatus({ profissionais, statuses, opcoes, atendimentosEmCurso, agora })` devolve o modelo de exibição já resolvido: status principal, declaração secundária, observação, tempo decorrido, vencido.

Concentra as três decisões do card: precedência (atendimento vence — AC-009), exclusão de inativo (AC-010) e formatação do tempo (AC-008). O componente vira um `map` sobre o resultado.

### `src/lib/relatorios/inclusao-profissional.ts`

`deveIncluirNoRelatorio(profissional, temRegistroNoPeriodo)` → `ativo === true || temRegistroNoPeriodo`.

Uma linha, mas é a regra que o dono decidiu em 10/08 e que hoje está errada no Tempo Fábril (`.eq('ativo', true)` apaga o passado). Isolada, ela fica provada em três cenários — trabalhou e saiu, saiu antes do período, está na folha sem registro.

## Migrations — quatro arquivos independentes

Separadas para permitir execução em paralelo e para que uma falha não bloqueie as outras.

| Arquivo | Faz | Critérios |
|---|---|---|
| `status_personalizados_observacao_migration.sql` | colunas de observação (×2) + `observacao_obrigatoria`; gatilho de log passa a copiar a observação para o bloco | AC-003 |
| `status_personalizados_fallback_1h_migration.sql` | teto de 1h + reset para `disponivel`, **nessa ordem** | AC-004, AC-005, AC-006 |
| `status_operacionais_contrato_migration.sql` | `ocupado` vira sistema, rótulo "Em atendimento", identificador preservado; remove o gatilho legado e as funções órfãs | AC-013, AC-018 |
| `profissional_inativo_migration.sql` | `inativado_em`, `ativo NOT NULL`, gatilho de limpeza na inativação | AC-017 |

**A ordem dentro do arquivo do fallback é o ponto mais sensível da feature.** Se o reset do status vier antes do fechamento do histórico, o gatilho de log fecha o bloco com a duração inteira e infla o Tempo Fábril — o risco de severidade Alta do RFC. AC-006 existe só para travar isso.

## Decisões de projeto

- **Uma migration por assunto, não uma por feature.** Cada uma é aplicável e reversível isoladamente no Studio.
- **Testes com import relativo**, não `@/` — o alias não é resolvido por `node --test` (ASM-001).
- **O componente do card não é testado**; o que é testado é `montarCardsStatus`, que carrega toda a decisão. O JSX restante é um `map` sem ramificação.
- **`origem: 'fallback'`** no reset do cron, para distinguir depois o que foi expiração automática do que foi ação do profissional.

## O que este design não protege

Comportamento real do Postgres: cascata de gatilhos, RLS, e o `pg_cron` executando de fato. A asserção estática pega regressão de texto e de ordem, não de semântica. Validação manual em produção segue necessária (Ação 11 do RFC).
