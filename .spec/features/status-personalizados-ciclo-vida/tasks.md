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
- Refs: AC-008, AC-009, AC-010, AC-020
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

## T-006 — Migration: teto do bloco e devolução para Disponível [concluida]
- Refs: AC-005, AC-006
- Arquivos: database/status_personalizados_fallback_1h_migration.sql
- Esforço: alto
- Notas: **ponto mais sensível da feature.** O fechamento do histórico tem de vir antes do reset do status — a ordem inversa faz o gatilho fechar o bloco com a duração inteira e inflar o Tempo Fábril. AC-006 existe para travar isso. Reset grava `origem = 'fallback'`. **Aplicada em produção em 10/08 com teto de 1h; o arquivo permanece como registro do que foi aplicado e o teto é reagendado por T-015.** As asserções de AC-004/AC-005/AC-006/AC-019 passaram para o teste de T-015, que cobre a migration vigente.

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

## T-010 — Configuração: marcar quais status exigem observação [concluida]
- Refs: AC-012
- Arquivos: src/actions/status-disponibilidade-config.ts, src/app/(painel)/configuracoes/status-disponibilidade/page.tsx
- Esforço: medio
- Notas: CRUD do campo `observacao_obrigatoria` e uso de `podeEditarOpcao` na guarda de edição/remoção. Depende de T-001 e T-002.

## T-011 — Widget: campo de observação na troca de status [concluida]
- Refs: AC-001, AC-011
- Arquivos: src/components/features/configuracoes/WidgetDisponibilidade.tsx
- Esforço: alto
- Notas: fluxo passa de clique único para clique + confirmação com campo de texto quando o status exigir. Trocar o filtro inline por `opcoesSelecionaveis`. Cuidar do retorno antecipado `if (novoStatus === myStatus) return`. Depende de T-001 e T-009.

## T-012 — Card de status na rota de agendamento [concluida]
- Refs: AC-008, AC-009, AC-010, AC-020
- Arquivos: src/components/features/agenda/CardStatusEquipe.tsx, src/app/(painel)/agenda/page.tsx
- Esforço: alto
- Notas: componente novo alimentado por `montarCardsStatus`, assinando o realtime que já existe. Layout da agenda é apertado (grade de 12 colunas). Sem horas acumuladas no dia (Q-001 respondida: não). Depende de T-003.

## T-013 — Relatório passa a incluir por presença de dado [concluida]
- Refs: AC-014, AC-015, AC-016
- Arquivos: src/app/(painel)/relatorios/tempo-fabril/page.tsx
- Esforço: medio
- Notas: trocar o `.eq('ativo', true)` da consulta por `deveIncluirNoRelatorio`, aplicado depois de carregar atendimentos e blocos de status do período. Depende de T-004.

## T-014 — Formulário: marcar quais status exigem justificativa [concluida]
- Refs: AC-021
- Arquivos: src/lib/status-disponibilidade-regras.ts, src/components/features/configuracoes/GerenciadorStatusDisponibilidade.tsx
- Esforço: baixo
- Notas: fecha o buraco de T-010, que prometia isto no título mas referenciava só AC-012. Estado do formulário (`FormularioOpcao`, `FORMULARIO_OPCAO_VAZIO`, `formularioDaOpcao`) sai do componente para o módulo de regras, de modo que o vai-e-vem opção↔formulário seja provável sem renderizar JSX.

---

## Emenda de 11/08/2026 — teto de 2 horas e contador regressivo

## T-015 — Migration: o teto do bloco volta para 2 horas [concluida]
- Refs: AC-004, AC-005, AC-006, AC-019
- Arquivos: database/status_personalizados_fallback_2h_migration.sql, test/sql/fallback-2h.test.ts
- Esforço: medio
- Notas: migration NOVA, que reagenda `fechar-status-esquecidos` — a de 1h **não é editada**, porque já foi aplicada em produção em 10/08 e o arquivo é o registro do que rodou. A ordem crítica de AC-006 (fechar histórico antes de resetar o status) é reproduzida integralmente: é a mesma armadilha, não some por ser a segunda vez. O teste substitui `test/sql/fallback-1h.test.ts`, que é REMOVIDO junto — deixá-lo faria a suíte exigir 1h e 2h ao mesmo tempo.

## T-016 — Regra pura do contador regressivo [concluida]
- Refs: AC-007, AC-022, AC-023, AC-024, AC-026
- Arquivos: src/lib/status-disponibilidade-regras.ts, src/lib/status-disponibilidade-regras.test.ts
- Esforço: medio
- Notas: `LIMITE_BLOCO_MS` passa a 2h e vira exportado; entram `tempoRestanteBlocoMs` (nunca negativo — AC-022) e `formatarContagemRegressiva` (`1h47` acima de uma hora, `47:05` abaixo — AC-023). `blocoVencido` já existe e passa a ser consumido de fato. Casos de borda que o teste precisa travar: exatamente no teto, um segundo depois, e muito depois (AC-024). Sem I/O — `agora` é sempre parâmetro, senão não há como testar.

## T-017 — O contador nas três telas de status [concluida]
- Refs: AC-025
- Arquivos: src/components/features/agenda/CardStatusEquipe.tsx, src/components/features/configuracoes/WidgetDisponibilidade.tsx, src/components/features/equipe/StatusEquipeRealtime.tsx, test/ui/contador-telas.test.ts
- Esforço: alto
- Notas: os três já têm um relógio próprio (60s, 60s e 30s) — para o contador de segundos a cadência vai a 1s, e **só quando há bloco personalizado em curso na tela**, para não manter um `setInterval` de segundo aceso à toa. O widget precisa do `atualizado_em` do próprio usuário, que `listarStatusDisponibilidade` já traz. Teste = asserção estática de que cada arquivo consome a regra pura (ASM-005) — é o formato que teria pego a falha do AC-021. Depende de T-016.

## T-019 — Migration: pôr status_disponibilidade na publicação do Realtime [concluida]
- Refs: AC-028
- Arquivos: database/realtime_status_disponibilidade_publication.sql, test/sql/realtime-publication.test.ts
- Esforço: baixo
- Notas: usa o mesmo bloco `DO $$` guardado por `pg_publication_tables` de `fn_status_equipe_agora_v2.sql` — e é justamente por ser guardado que aquele sobreviveu à recriação da publicação no self-hosted, enquanto o `alter publication` solto de `status_disponibilidade_migration.sql:26` se perdeu. Corrige a causa-raiz achada em 11/08. Não depende de nenhuma outra tarefa.

## T-020 — Rede de polling no card da agenda [concluida]
- Refs: AC-029
- Arquivos: src/components/features/agenda/CardStatusEquipe.tsx, src/actions/status-disponibilidade.ts, test/ui/contador-telas.test.ts
- Esforço: medio
- Notas: o card passa a rebuscar as declarações periodicamente, como `useRealtimeDisponibilidade` já faz. Reusar `listarStatusDisponibilidade`, que já traz `profissional_id, status, atualizado_em` — precisa passar a trazer `observacao` também, senão a releitura apaga o motivo exibido no card. Cuidar de não sobrescrever estado bom com lista vazia em erro silencioso do RPC, a mesma defesa que o hook já tem.

## T-018 — Diagnóstico do Realtime em produção [concluida]
- Refs: AC-027
- Arquivos: database/diagnostico_realtime_status.sql, test/sql/diagnostico-realtime.test.ts
- Esforço: baixo
- Notas: somente leitura. Checa `pg_publication_tables` (a tabela está na publicação?), `relreplident` (UPDATE entrega a linha nova?), as políticas de RLS de `status_disponibilidade` (o Realtime aplica RLS do assinante — publicação sem política de leitura entrega silêncio) e `cron.job_run_details` (o job rodou e alterou linhas?). Responde Q-002 e alimenta a decisão de Q-003. Não depende de nenhuma outra tarefa.

---

## Emenda de 11/08/2026 (2) — catálogo e redesenho da tela de disponibilidade

## T-021 — Passar o catálogo de status para as duas visões [concluida]
- Refs: AC-030, AC-031
- Arquivos: src/app/(painel)/configuracoes/disponibilidade/page.tsx, src/components/features/equipe/StatusEquipeRealtime.tsx, test/ui/catalogo-disponibilidade.test.ts
- Esforço: baixo
- Notas: a página chama `listarStatusOpcoes()` e passa `opcoes` nas duas montagens de `StatusEquipeRealtime` — hoje nenhuma passa, e o componente cai no `DEFAULT_OPCOES` de 4 slugs. Junto, inverter o padrão do fallback (AC-031): slug desconhecido passa a ser tratado como declarado, não como sistema. Não depende de nenhuma outra tarefa.

## T-022 — Redesenhar o painel "Status agora" [concluida]
- Refs: AC-032
- Arquivos: src/components/features/equipe/StatusEquipeRealtime.tsx, src/lib/status-painel-equipe.ts, src/lib/status-painel-equipe.test.ts
- Esforço: alto
- Notas: hoje é uma faixa única de chips minúsculos, sem hierarquia — quem está em reunião há 2h tem o mesmo peso visual de quem está livre. O agrupamento sai para regra pura (`agruparPainelEquipe`), testável sem JSX, como já é o padrão da feature. Depende de T-021.

## T-023 — Redesenhar cabeçalho, navegação e grades das duas visões [pendente]
- Refs: AC-032
- Arquivos: src/app/(painel)/configuracoes/disponibilidade/page.tsx
- Esforço: alto
- Notas: cabeçalho unificado entre geral e individual; o `<select>` com botão "Ver" vira troca direta; a grade sai de 9-10px para tamanhos legíveis. **Cuidado:** são 833 linhas com duas visões e cálculo de slots no meio — não tocar em `calcularSlotsLivres`, `buildNomesExibicao` nem nas consultas. Só apresentação. Depende de T-021.
