# Plano de execução — status-personalizados-ciclo-vida

> gerado por `onp-spec plano` em 2026-08-11 12:12 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano status-personalizados-ciclo-vida`

## Resumo — o que vai acontecer

- **4 tarefa(s) pendente(s)**: 4 em 4 faixa(s) paralela(s) + 0 sequencial(is) (14 já concluída(s): T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010, T-011, T-012, T-013, T-014)
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano status-personalizados-ciclo-vida --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/status-personalizados-ciclo-vida`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/status-personalizados-ciclo-vida-faixa-1` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-015 | Migration: o teto do bloco volta para 2 horas | `claude-sonnet-5` | medium | `database/status_personalizados_fallback_2h_migration.sql`, `test/sql/fallback-2h.test.ts` |

#### faixa-2 — branch `spec/status-personalizados-ciclo-vida-faixa-2` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-016 | Regra pura do contador regressivo | `claude-sonnet-5` | medium | `src/lib/status-disponibilidade-regras.ts`, `src/lib/status-disponibilidade-regras.test.ts` |

#### faixa-3 — branch `spec/status-personalizados-ciclo-vida-faixa-3` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-017 | O contador nas três telas de status | `claude-sonnet-5` | high | `src/components/features/agenda/CardStatusEquipe.tsx`, `src/components/features/configuracoes/WidgetDisponibilidade.tsx`, `src/components/features/equipe/StatusEquipeRealtime.tsx`, `test/ui/contador-telas.test.ts` |

### Onda 2 — faixa-4

#### faixa-4 — branch `spec/status-personalizados-ciclo-vida-faixa-4` — worktree `../onp-worktrees/medguia-hub-status-personalizados-ciclo-vida-faixa-4`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-018 | Diagnóstico do Realtime em produção | `claude-sonnet-5` | low | `database/diagnostico_realtime_status.sql`, `test/sql/diagnostico-realtime.test.ts` |

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

