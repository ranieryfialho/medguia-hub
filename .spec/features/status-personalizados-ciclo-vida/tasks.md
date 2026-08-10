# Tasks: Ciclo de vida dos status personalizados

> feature: status-personalizados-ciclo-vida

Ordem de execução: as tarefas de **regra pura** (T-001 a T-004) e as de **migration** (T-005 a T-008) são independentes entre si. As de **ligação** (T-009 a T-013) consomem as regras puras e só devem rodar depois delas.

## T-001 — Regras puras de status: validação, classificação e vencimento [concluida]
- Refs: AC-001, AC-002, AC-007, AC-011, AC-012
- Arquivos: src/lib/status-disponibilidade-regras.ts, src/lib/status-disponibilidade-regras.test.ts
- Esforço: medio
- Notas: `validarObservacao`, `ehStatusPersonalizado`, `opcoesSelecionaveis`, `podeEditarOpcao`, `blocoVencido`. `opcoesSelecionaveis` extrai a lógica que hoje está inline no widget. Import relativo nos testes — o alias `@/` não é resolvido por `node --test` (ASM-001). Não depende de nenhuma outra tarefa.

## T-002 — Catálogo no cliente: "Em atendimento" vira status de sistema [concluida]
- Refs: AC-011, AC-013
- Arquivos: src/lib/status-disponibilidade-cores.ts
- Esforço: baixo
- Notas: em `DEFAULT_OPCOES`, `ocupado` passa a `sistema: true` e rótulo "Em atendimento" / "atendimento". **Não mexer no identificador `ocupado`** — está fixo em quatro pontos do sistema. Acrescentar `observacao_obrigatoria: boolean` ao tipo `OpcaoStatus`.

## T-003 — Modelo de exibição do card da agenda [concluida]
- Refs: AC-008, AC-009, AC-010
- Arquivos: src/lib/status-card-agenda.ts, src/lib/status-card-agenda.test.ts
- Esforço: alto
- Notas: `montarCardsStatus` concentra as três decisões — atendimento em curso vence a declaração (AC-009, decisão de 10/08), inativo fora da lista (AC-010), tempo decorrido formatado (AC-008). Devolve modelo pronto; o componente só percorre. Depende do tipo alterado em T-002.

## T-004 — Regra de inclusão de profissional no relatório [concluida]
- Refs: AC-014, AC-015, AC-016
- Arquivos: src/lib/relatorios/inclusao-profissional.ts, src/lib/relatorios/inclusao-profissional.test.ts
- Esforço: baixo
- Notas: `ativo === true || temRegistroNoPeriodo`. Três cenários de teste — trabalhou e saiu, saiu antes do período, está na folha sem registro. Não depende de nenhuma outra tarefa.

## T-005 — Migration: observação com lastro no histórico [concluida]
- Refs: AC-003
- Arquivos: database/status_personalizados_observacao_migration.sql, test/sql/observacao.test.ts
- Esforço: medio
- Notas: `observacao` em `status_disponibilidade` e em `historico_status_disponibilidade`; `observacao_obrigatoria` em `status_disponibilidade_opcoes`. O gatilho de log passa a copiar a observação ao abrir o bloco, para que ela sobreviva à próxima troca. Teste = asserção estática sobre o texto do arquivo (ASM-002).

## T-006 — Migration: teto de 1 hora e devolução para Disponível [concluida]
- Refs: AC-004, AC-005, AC-006
- Arquivos: database/status_personalizados_fallback_1h_migration.sql, test/sql/fallback-1h.test.ts
- Esforço: alto
- Notas: **ponto mais sensível da feature.** O fechamento do histórico tem de vir antes do reset do status — a ordem inversa faz o gatilho fechar o bloco com a duração inteira e inflar o Tempo Fábril. AC-006 existe para travar isso. Reset grava `origem = 'fallback'`.

## T-007 — Migration: contrato dos operacionais e remoção do gatilho legado [concluida]
- Refs: AC-013, AC-018
- Arquivos: database/status_operacionais_contrato_migration.sql, test/sql/contrato-operacionais.test.ts
- Esforço: medio
- Notas: `ocupado` → `sistema = true` e rótulo "Em atendimento", identificador preservado. Remove `trg_concluir_atendimento`, `fn_trigger_concluir_atendimento` e a função órfã `fn_atualizar_status_em_atendimento`. Limpa os resíduos em `'ocupado'` (um desde 29/05, de profissional já desligado).

## T-008 — Migration: profissional inativo [concluida]
- Refs: AC-017
- Arquivos: database/profissional_inativo_migration.sql, test/sql/profissional-inativo.test.ts
- Esforço: medio
- Notas: `profiles.inativado_em`; normalizar nulos e tornar `ativo` obrigatório (seguro — ASM-004 confirmada); gatilho em `profiles` que ao inativar grava a data, fecha o bloco aberto e remove a linha de estado ao vivo. Histórico preservado.

## T-009 — Ligar a validação de observação na action [concluida]
- Refs: AC-001, AC-002
- Arquivos: src/actions/status-disponibilidade.ts
- Esforço: medio
- Notas: `setStatusDisponibilidade` passa a receber a observação, buscar a opção no catálogo e chamar `validarObservacao` **no servidor** antes de gravar. Grava a observação junto do status. Depende de T-001.

## T-010 — Configuração: marcar quais status exigem observação [pendente]

- Refs: AC-012
- Arquivos: src/actions/status-disponibilidade-config.ts, src/app/(painel)/configuracoes/status-disponibilidade/page.tsx
- Esforço: medio
- Notas: CRUD do campo `observacao_obrigatoria` e uso de `podeEditarOpcao` na guarda de edição/remoção. Depende de T-001 e T-002.

## T-011 — Widget: campo de observação na troca de status [pendente]

- Refs: AC-001, AC-011
- Arquivos: src/components/features/configuracoes/WidgetDisponibilidade.tsx
- Esforço: alto
- Notas: fluxo passa de clique único para clique + confirmação com campo de texto quando o status exigir. Trocar o filtro inline por `opcoesSelecionaveis`. Cuidar do retorno antecipado `if (novoStatus === myStatus) return`. Depende de T-001 e T-009.

## T-012 — Card de status na rota de agendamento [pendente]

- Refs: AC-008, AC-009, AC-010
- Arquivos: src/components/features/agenda/CardStatusEquipe.tsx, src/app/(painel)/agenda/page.tsx
- Esforço: alto
- Notas: componente novo alimentado por `montarCardsStatus`, assinando o realtime que já existe. Layout da agenda é apertado (grade de 12 colunas). Sem horas acumuladas no dia (Q-001 respondida: não). Depende de T-003.

## T-013 — Relatório passa a incluir por presença de dado [pendente]

- Refs: AC-014, AC-015, AC-016
- Arquivos: src/app/(painel)/relatorios/tempo-fabril/page.tsx
- Esforço: medio
- Notas: trocar o `.eq('ativo', true)` da consulta por `deveIncluirNoRelatorio`, aplicado depois de carregar atendimentos e blocos de status do período. Depende de T-004.
