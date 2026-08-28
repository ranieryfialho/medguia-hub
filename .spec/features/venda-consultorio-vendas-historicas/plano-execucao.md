# Plano de execução — venda-consultorio-vendas-historicas

> gerado por `onp-spec plano` em 2026-08-28 01:00 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano venda-consultorio-vendas-historicas --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 17 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/venda-consultorio-vendas-historicas`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-001 | Migration: coluna venda_em_consultorio, CHECK e índices | `claude-sonnet-5` | medium |
| T-002 | Toggle no formulário de nova venda | `claude-sonnet-5` | medium |
| T-003 | Toggle no formulário de edição de venda | `claude-sonnet-5` | medium |
| T-004 | Validação do toggle nas Server Actions | `claude-sonnet-5` | medium |
| T-005 | Testes unitários do toggle nas actions | `claude-sonnet-5` | medium |
| T-006 | fn_vendas_resumo_mensal (CTE canônica de venda contável) | `claude-sonnet-5` | medium |
| T-007 | fn_vendas_detalhe_mes (drill-down) | `claude-sonnet-5` | medium |
| T-008 | Roteiro de teste SQL manual das funções | `claude-sonnet-5` | medium |
| T-009 | Segmentação consultório/fisio em /relatorios/vendas | `claude-sonnet-5` | medium |
| T-010 | Bloco de resumo médico no PDF de vendas | `claude-sonnet-5` | medium |
| T-011 | Migrar KPIs de /relatorios/vendas para fn_vendas_resumo_mensal + paginação da listagem | `claude-sonnet-5` | medium |
| T-012 | Testes unitários de agregação e MoM (funções puras) | `claude-sonnet-5` | medium |
| T-013 | Menu lateral: link para /relatorios/vendas-historicas | `claude-sonnet-5` | medium |
| T-014 | Rota /relatorios/vendas-historicas: cards, gráfico, tabela, filtros | `claude-sonnet-5` | medium |
| T-015 | Drill-down expansível por linha da tabela histórica | `claude-sonnet-5` | medium |
| T-016 | Exportação PDF e XLSX do relatório histórico | `claude-sonnet-5` | medium |
| T-017 | Verificação de controle de acesso da rota histórica | `claude-sonnet-5` | medium |

## Gestão de branches e commits

1. branch de trabalho `spec/venda-consultorio-vendas-historicas` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify venda-consultorio-vendas-historicas` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Claude Code headless

```bash
bash .spec/features/venda-consultorio-vendas-historicas/executar-tarefas.sh
```

Cada tarefa roda `claude -p` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `--effort` já definidos por tarefa e permissões `acceptEdits`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/medguia-hub-venda-consultorio-vendas-historicas-logs/`.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo venda-consultorio-vendas-historicas --tabela   # a tabela de andamento
onp-spec resumo venda-consultorio-vendas-historicas            # o resumo em texto
```

