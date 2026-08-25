# Plano de execução — auditoria-exclusao-agendamentos

> gerado por `onp-spec plano` em 2026-08-25 12:51 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano auditoria-exclusao-agendamentos --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 10 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/auditoria-exclusao-agendamentos`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-033 | Migration: tabela `agendamentos_auditoria` (append-only) + índices + trigger + RLS de SELECT | `claude-sonnet-5` | medium |
| T-034 | Migration: catálogo `motivos_exclusao_agendamento` + seed do PRD | `claude-sonnet-5` | low |
| T-035 | `fn_excluir_atendimentos`: validações, bloqueio de concluídos, snapshot, delete, limpeza de série | `claude-sonnet-5` | high |
| T-036 | Testes estáticos de SQL (forma e ordem da migration/função) | `claude-sonnet-5` | low |
| T-037 | Refatorar as 4 Server Actions de exclusão para casca fina sobre a RPC | `claude-sonnet-5` | high |
| T-038 | Passo de motivo no `AgendamentoModal` (avulso, pontual, série completa) | `claude-sonnet-5` | medium |
| T-039 | Passo de motivo no `ModalSelecaoExclusao` (lote) | `claude-sonnet-5` | low |
| T-040 | Aba "Logs" em `/pacientes/[id]` | `claude-sonnet-5` | medium |
| T-041 | Painel `/relatorios/auditoria-exclusoes` com os 4 filtros | `claude-sonnet-5` | medium |
| T-042 | Roteiro de aplicação em produção + validação manual dos 4 escopos e das 2 recusas de trigger | `claude-sonnet-5` | low |

## Gestão de branches e commits

1. branch de trabalho `spec/auditoria-exclusao-agendamentos` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify auditoria-exclusao-agendamentos` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Claude Code headless

```bash
bash .spec/features/auditoria-exclusao-agendamentos/executar-tarefas.sh
```

Cada tarefa roda `claude -p` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `--effort` já definidos por tarefa e permissões `acceptEdits`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/medguia-hub-auditoria-exclusao-agendamentos-logs/`.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo auditoria-exclusao-agendamentos --tabela   # a tabela de andamento
onp-spec resumo auditoria-exclusao-agendamentos            # o resumo em texto
```

