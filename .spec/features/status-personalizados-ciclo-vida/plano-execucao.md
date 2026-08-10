# Plano de execução — status-personalizados-ciclo-vida

> gerado por `onp-spec plano` em 2026-08-10 17:22 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano status-personalizados-ciclo-vida --paralelizar T-001,T-002,T-004,T-005,T-006,T-007,T-008`

## Resumo — o que vai acontecer

- **13 tarefa(s) pendente(s)**: 7 em 7 faixa(s) paralela(s) + 6 sequencial(is)
- **seleção do usuário**: paralelizar só T-001, T-002, T-004, T-005, T-006, T-007, T-008 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano status-personalizados-ciclo-vida --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/status-personalizados-ciclo-vida`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/status-personalizados-ciclo-vida-faixa-1` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-001 | Regras puras de status: validação, classificação e vencimento | `claude-sonnet-5` | medium | `src/lib/status-disponibilidade-regras.ts`, `src/lib/status-disponibilidade-regras.test.ts` |

#### faixa-2 — branch `spec/status-personalizados-ciclo-vida-faixa-2` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-002 | Catálogo no cliente: "Em atendimento" vira status de sistema | `claude-sonnet-5` | low | `src/lib/status-disponibilidade-cores.ts` |

#### faixa-3 — branch `spec/status-personalizados-ciclo-vida-faixa-3` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-004 | Regra de inclusão de profissional no relatório | `claude-sonnet-5` | low | `src/lib/relatorios/inclusao-profissional.ts`, `src/lib/relatorios/inclusao-profissional.test.ts` |

### Onda 2 — faixa-4 ∥ faixa-5 ∥ faixa-6

#### faixa-4 — branch `spec/status-personalizados-ciclo-vida-faixa-4` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-4`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-005 | Migration: observação com lastro no histórico | `claude-sonnet-5` | medium | `database/status_personalizados_observacao_migration.sql`, `test/sql/observacao.test.ts` |

#### faixa-5 — branch `spec/status-personalizados-ciclo-vida-faixa-5` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-5`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-006 | Migration: teto de 1 hora e devolução para Disponível | `claude-sonnet-5` | high | `database/status_personalizados_fallback_1h_migration.sql`, `test/sql/fallback-1h.test.ts` |

#### faixa-6 — branch `spec/status-personalizados-ciclo-vida-faixa-6` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-6`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-007 | Migration: contrato dos operacionais e remoção do gatilho legado | `claude-sonnet-5` | medium | `database/status_operacionais_contrato_migration.sql`, `test/sql/contrato-operacionais.test.ts` |

### Onda 3 — faixa-7

#### faixa-7 — branch `spec/status-personalizados-ciclo-vida-faixa-7` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-7`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-008 | Migration: profissional inativo | `claude-sonnet-5` | medium | `database/profissional_inativo_migration.sql`, `test/sql/profissional-inativo.test.ts` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-003 | Modelo de exibição do card da agenda | `claude-sonnet-5` | high | fora da seleção do usuário |
| T-009 | Ligar a validação de observação na action | `claude-sonnet-5` | medium | fora da seleção do usuário |
| T-010 | Configuração: marcar quais status exigem observação | `claude-sonnet-5` | medium | fora da seleção do usuário |
| T-011 | Widget: campo de observação na troca de status | `claude-sonnet-5` | high | fora da seleção do usuário |
| T-012 | Card de status na rota de agendamento | `claude-sonnet-5` | high | fora da seleção do usuário |
| T-013 | Relatório passa a incluir por presença de dado | `claude-sonnet-5` | medium | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/status-personalizados-ciclo-vida` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify status-personalizados-ciclo-vida` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Claude Code headless

```bash
bash .spec/features/status-personalizados-ciclo-vida/executar-tarefas.sh
```

Cada faixa roda `claude -p` com **janela de contexto limpa**, no seu worktree, com
`--model` e `--effort` já definidos por tarefa e permissões `acceptEdits`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-logs/`.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo status-personalizados-ciclo-vida --tabela   # a tabela de andamento
onp-spec resumo status-personalizados-ciclo-vida            # o resumo em texto
```

