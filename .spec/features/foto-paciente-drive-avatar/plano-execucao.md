# Plano de execução — foto-paciente-drive-avatar

> gerado por `onp-spec plano` em 2026-09-02 19:32 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano foto-paciente-drive-avatar --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 15 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/foto-paciente-drive-avatar`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-001 | Migração SQL: colunas de foto em `pacientes` | `claude-sonnet-5` | medium |
| T-002 | Módulo cliente de validação e redimensionamento de imagem | `claude-sonnet-5` | medium |
| T-003 | `garantirPastaPacientePorId` chamada com `await` em `criarPaciente`; action retorna `pacienteId` em vez de redirecionar | `claude-sonnet-5` | medium |
| T-004 | Rota `POST/DELETE /api/pacientes/[id]/foto` | `claude-sonnet-5` | medium |
| T-005 | Cliente orquestra pós-cadastro: upload de foto após `pacienteId`, toast de warning em falha do Drive | `claude-sonnet-5` | medium |
| T-006 | Troca/remoção de foto na edição, fora do submit | `claude-sonnet-5` | medium |
| T-007 | Componente único `AvatarPaciente` | `claude-sonnet-5` | medium |
| T-008 | Lightbox extraído de `TabMidiasPaciente` + prop `ampliavel` no `AvatarPaciente` | `claude-sonnet-5` | medium |
| T-009 | Migrar os 8 pontos de renderização existentes para `AvatarPaciente` | `claude-sonnet-5` | medium |
| T-010 | Autenticação do proxy de leitura de foto (comportamento existente, sem alteração) | `claude-sonnet-5` | medium |
| T-011 | Medir baseline de performance da agenda (dia cheio, views dia/semana/mês) | `claude-sonnet-5` | medium |
| T-012 | Avatar na agenda (views dia e semana) | `claude-sonnet-5` | medium |
| T-013 | Remedir a agenda e decidir manter/reverter (Decisão F) | `claude-sonnet-5` | medium |
| T-014 | Rotina automática de limpeza de arquivos órfãos no Drive | `claude-sonnet-5` | medium |
| T-015 | Exclusão automática da foto ao inativar paciente por óbito | `claude-sonnet-5` | medium |

## Gestão de branches e commits

1. branch de trabalho `spec/foto-paciente-drive-avatar` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify foto-paciente-drive-avatar` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Claude Code headless

```bash
bash .spec/features/foto-paciente-drive-avatar/executar-tarefas.sh
```

Cada tarefa roda `claude -p` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `--effort` já definidos por tarefa e permissões `acceptEdits`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/medguia-hub-foto-paciente-drive-avatar-logs/`.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo foto-paciente-drive-avatar --tabela   # a tabela de andamento
onp-spec resumo foto-paciente-drive-avatar            # o resumo em texto
```

