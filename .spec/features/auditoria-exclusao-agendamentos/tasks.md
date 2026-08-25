# Tasks: Auditoria exclusao agendamentos

> feature: auditoria-exclusao-agendamentos

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - T-xxx = tarefa (código de rastreio, único no projeto inteiro).
  - Toda tarefa referencia em `Refs:` pelo menos uma história de usuário
    (US-xxx) ou critério de aceite (AC-xxx).
  - Toda tarefa lista os arquivos que cria/altera em `Arquivos:` — capriche:
    é o que decide o que `onp-spec plano` roda em PARALELO (arquivos
    disjuntos) e o que roda em sequência.
  - Campos opcionais por tarefa, usados pelo plano de execução:
    `- Modelo: claude-sonnet-5` e `- Esforço: alto` (baixo|medio|alto|xalto|max).
  - Uma tarefa só pode virar [concluida] quando os critérios de aceite dela
    tiverem prova PASS registrada por `onp-spec verify`.
  Status: pendente | em-andamento | concluida
    (atalho: `onp-spec tarefa <feature> <T-xxx> <status>`)
-->

## T-033 — Migration: tabela `agendamentos_auditoria` (append-only) + índices + trigger + RLS de SELECT [concluida]
- Refs: US-015, US-018, AC-053, AC-055, AC-058
- Arquivos: database/agendamentos_auditoria_migration.sql
- Notas: sem `REFERENCES` para `atendimentos`/`pacientes`/`profiles` (ver design.md). Trigger `BEFORE UPDATE OR DELETE` → `RAISE`. RLS de SELECT liberada para qualquer usuário autenticado (ASM-012). Aplicada via SQL Editor do Studio. Bloqueia T-035.
- Esforço: medio

## T-034 — Migration: catálogo `motivos_exclusao_agendamento` + seed do PRD [concluida]
- Refs: US-010, AC-044, AC-045, AC-057
- Arquivos: database/motivos_exclusao_agendamento_migration.sql
- Notas: seed com as 6 categorias do PRD; `outros` com `exige_observacao = true`. Bloqueia T-035.
- Esforço: baixo

## T-035 — `fn_excluir_atendimentos`: validações, bloqueio de concluídos, snapshot, delete, limpeza de série [concluida]
- Refs: US-014, US-015, US-016, US-017, AC-046, AC-047, AC-048, AC-049, AC-050, AC-051, AC-052, AC-053, AC-054, AC-056, AC-057
- Arquivos: database/fn_excluir_atendimentos_migration.sql
- Notas: `SECURITY DEFINER` + `SET search_path = public, pg_temp` (obrigatório). `INSERT` do log **antes** do `DELETE`, dentro da mesma transação. Bloqueio de "Concluído" é absoluto (ASM-011) — qualquer alvo concluído aborta a operação inteira. Depende de T-033, T-034. Bloqueia T-037.
- Esforço: alto

## T-036 — Testes estáticos de SQL (forma e ordem da migration/função) [concluida]
- Refs: AC-053, AC-054, AC-055
- Arquivos: test/sql/auditoria-exclusao.test.ts
- Notas: assere ausência de `REFERENCES` na tabela de auditoria, presença do trigger `BEFORE UPDATE OR DELETE`, `SET search_path` na função, e que o `INSERT` no log aparece antes do `DELETE` no corpo da função (mesma técnica de `test/sql/` já usada no projeto — não executa Postgres). Depende de T-033, T-034, T-035.
- Esforço: baixo

## T-037 — Refatorar as 4 Server Actions de exclusão para casca fina sobre a RPC [concluida]
- Refs: US-010, US-011, US-012, US-013, US-016, AC-044, AC-046, AC-047, AC-048, AC-049, AC-050, AC-051, AC-052, AC-056, AC-057
- Arquivos: src/actions/agenda.ts
- Notas: `deletarAgendamento`, `deletarAtendimentoPontualDaRecorrencia`, `deletarTodasRecorrencias`, `deletarAtendimentosSelecionados` ganham parâmetro `motivo`. `usuario_id`/`usuario_nome` resolvidos do contexto de `requirePermissaoAgendaAdmin()`, nunca do cliente. Reposição da sessão pontual continua best-effort, depois da RPC confirmar. Depende de T-035.
- Esforço: alto

## T-038 — Passo de motivo no `AgendamentoModal` (avulso, pontual, série completa) [concluida]
- Refs: US-010, US-011, US-012, AC-044, AC-045, AC-046, AC-047, AC-048, AC-049
- Arquivos: src/components/features/agenda/AgendamentoModal.tsx
- Notas: botões de categoria + campo de observação condicional; confirmação desabilitada sem motivo válido; aviso reforçado de contagem de sessões para série completa. Depende de T-037.
- Esforço: medio

## T-039 — Passo de motivo no `ModalSelecaoExclusao` (lote) [concluida]
- Refs: US-013, AC-044, AC-045, AC-050, AC-051
- Arquivos: src/components/features/agenda/ModalSelecaoExclusao.tsx
- Notas: mesmo padrão de motivo do T-038, aplicado ao lote selecionado. Depende de T-037.
- Esforço: baixo

## T-040 — Aba "Logs" em `/pacientes/[id]` [pendente]

- Refs: US-018, AC-058
- Arquivos: src/actions/pacientes.ts, src/components/features/pacientes/TabLogsPaciente.tsx, src/components/features/pacientes/PacienteTabsClient.tsx
- Notas: nova query `buscarLogsExclusaoPaciente(pacienteId)`; nova entrada em `TABS` sem `modulo` (visível a todo usuário com acesso ao paciente, ASM-012); lista quem excluiu · quando · escopo · motivo · dados da sessão apagada, mais recente primeiro; nota fixa de que logs são imutáveis. Depende de T-033, T-037 (precisa de logs já sendo gravados para validar em produção, mas pode ser implementada em paralelo usando dados de teste).
- Esforço: medio

## T-041 — Painel `/relatorios/auditoria-exclusoes` com os 4 filtros [pendente]

- Refs: US-019, AC-059, AC-060
- Arquivos: src/app/(painel)/relatorios/auditoria-exclusoes/page.tsx, src/actions/relatorios-auditoria.ts
- Notas: gate `isGestorSistema`; filtros de período, profissional, operador e motivo combinados; paginação server-side sobre os índices de T-033. Depende de T-033, T-037.
- Esforço: medio

## T-042 — Roteiro de aplicação em produção + validação manual dos 4 escopos e das 2 recusas de trigger [pendente]

- Refs: US-014, US-015, US-016, US-017, AC-049, AC-050, AC-052, AC-054, AC-055, AC-056, AC-057
- Arquivos: docs/ROTEIRO_APLICACAO_auditoria_exclusao.md
- Notas: roteiro assinado cobrindo os cenários de recusa da RPC (motivo inválido, `outros` sem observação, `usuario_id` nulo, concluído bloqueado) e do trigger (`UPDATE`/`DELETE` recusados). Escrito por último, depois de T-033, T-034, T-035, T-036, T-037, T-038, T-039, T-040, T-041 concluídas — não roda em paralelo com nenhuma outra tarefa.
- Esforço: baixo
