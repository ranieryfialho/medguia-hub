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

## T-023 — Redesenhar cabeçalho, navegação e grades das duas visões [concluida]
- Refs: AC-032
- Arquivos: src/app/(painel)/configuracoes/disponibilidade/page.tsx
- Esforço: alto
- Notas: cabeçalho unificado entre geral e individual; o `<select>` com botão "Ver" vira troca direta; a grade sai de 9-10px para tamanhos legíveis. **Cuidado:** são 833 linhas com duas visões e cálculo de slots no meio — não tocar em `calcularSlotsLivres`, `buildNomesExibicao` nem nas consultas. Só apresentação. Depende de T-021.

## T-024 — Status removido continua legível onde já foi usado [concluida]
- Refs: AC-033
- Arquivos: src/actions/status-disponibilidade-config.ts, src/lib/status-disponibilidade-regras.ts, src/lib/status-disponibilidade-regras.test.ts
- Esforço: baixo
- Notas: `listarStatusOpcoesParaExibicao()` devolve o catálogo completo, para as quatro superfícies de EXIBIÇÃO (agenda, disponibilidade, widget via layout, Tempo Fábril). `listarStatusOpcoes()` continua filtrando `ativo` e serve a tela de gerenciamento e a escolha. Como o catálogo completo passa a chegar no widget, `opcoesSelecionaveis` ganha o filtro de `ativo` — a exclusão deixa de ser efeito colateral de um WHERE e vira regra testada.

## T-025 — A observação chega ao Tempo Fábril [concluida]
- Refs: AC-034
- Arquivos: src/app/(painel)/relatorios/tempo-fabril/page.tsx, src/lib/relatorios/kpis-tempo-fabril.ts, src/components/features/relatorios/TabelaTempoFabril.tsx, src/components/features/relatorios/ConteudoRelatorio.tsx, test/ui/observacao-tempo-fabril.test.ts
- Esforço: baixo
- Notas: a observação atravessa cinco arquivos entre o banco e a tela — consulta (dois recortes: fechados e abertos), tipo do histórico, tipo do detalhe, montagem, coluna. O dado já existia em produção desde 10/08; faltava só ler. O teste trava cada elo, porque o modo de falha é sumiço silencioso.

## T-026 — Bloco expirado não se confunde com anômalo [concluida]
- Refs: AC-035
- Arquivos: src/lib/status-disponibilidade-regras.ts, src/lib/status-disponibilidade-regras.test.ts, src/components/features/relatorios/TabelaTempoFabril.tsx
- Esforço: baixo
- Notas: `classificarBloco` + `LIMITE_BLOCO_MIN` na regra pura. `LIMITE_ALERTA_MIN` sai de 110 fixo e passa a derivar do teto (`+1`): o vermelho fica reservado ao bloco fechado ACIMA do teto, que é o sinal da inversão de ordem que AC-006 impede. Bloco no teto ganha selo âmbar "expirou".

## T-027 — As exportações PDF e Markdown levam motivo e marca de expirado [concluida]
- Refs: AC-036
- Arquivos: src/lib/relatorios/markdown-tempo-fabril.ts, src/lib/relatorios/markdown-tempo-fabril.test.ts, src/lib/relatorios/pdf-tempo-fabril.ts, src/lib/relatorios/kpis-tempo-fabril.ts, src/lib/jornada-planejada.ts, test/ui/pdf-tempo-fabril.test.ts
- Esforço: medio
- Notas: os dois exports já recebiam `KPIsProfissional` e `statusOpcoes` — a observação estava disponível e não era renderizada. Markdown ganhou `escaparPipe` (texto livre com `|` ou quebra de linha destruía a tabela em silêncio). PDF ganhou coluna Motivo com larguras rebalanceadas para 178mm, alinhamento por coluna e `truncarParaLargura` — `maxWidth` do jsPDF quebra o texto e transborda a linha de altura fixa. Para tornar o Markdown testável de verdade, os imports `@/` da cadeia (markdown → kpis → jornada-planejada) viraram relativos com extensão, mesmo padrão de ASM-001 já usado em `src/actions/status-disponibilidade.ts`.

## T-028 — Havendo atendimento marcado, o status para e vira "Em atendimento" [concluida]
- Refs: AC-037, AC-038, AC-042
- Arquivos: database/status_para_na_hora_do_atendimento_migration.sql, test/sql/para-na-hora-do-atendimento.test.ts
- Esforço: alto
- Notas: **não é gatilho** — os fisios nem sempre marcam "Em Atendimento", então o gancho é o relógio. Reagenda `fechar-status-esquecidos` (`*/10 * * * *`) acrescentando um terceiro comando ao `$cron$`, sem tocar nos dois que já existem (teto de 2h + rede de destravamento). Não editar `status_personalizados_fallback_2h_migration.sql`: ele é o registro do que rodou: esta migration supersede, mesmo padrão da de 1h→2h. Forma do comando: CTE `SELECT h.id, MIN(a.data_agendamento) AS fim_calculado ... GROUP BY h.id` → CTE de `UPDATE historico ... RETURNING profissional_id` → `UPDATE status_disponibilidade` gravando **`status = 'disponivel'`** com `origem = 'agenda'`. **Nunca gravar `'ocupado'`**, por mais que o critério fale em "Em atendimento": `ocupado` é derivado pela regra 1 da `fn_status_equipe_agora` e foi marcado como status de sistema em AC-011 exatamente para não ser escrito à mão — gravá-lo é reintroduzir a Divergência 1 do RFC 002. Apagar a declaração já produz "Em atendimento" na tela enquanto durar a janela — e **a constraint precisa ser ampliada antes**: `status_disponibilidade_origem_check` hoje aceita só `('manual','automatico','fallback')` (`status_personalizados_fallback_1h_migration.sql:34`). Sem o `DROP CONSTRAINT ... ADD CONSTRAINT` no topo, o job falha em silêncio a cada 10 minutos — o `pg_cron` registra o erro em `cron.job_run_details` e mais nada; foi assim que o defeito original desta feature passou dois meses despercebido. Três pontos que o teste trava: (1) `MIN`, senão o Postgres escolhe um atendimento arbitrário entre dois elegíveis (AC-038); (2) histórico antes do status, senão o gatilho de log fecha com `fim = NOW()` (AC-038 / AC-006); (3) `a.data_agendamento >= h.inicio`, senão grava fim anterior ao início (AC-042). Filtro de atendimento **positivo** com `lower(a.status) IN ('confirmado','aguardando','aguardando consulta','em atendimento','concluído','concluido')` — lista negativa erra em silêncio por causa das variantes de `Reagendado` (`Reposição`, `reposicao`). Junta por `a.profissional_id = h.profissional_id OR a.fisioterapeuta_id = h.profissional_id` (ASM-007). Termina com a mesma conferência da migration anterior. Asserção estática (ASM-002).

## T-029 — A interseção conta uma vez só, para o atendimento [concluida]
- Refs: AC-039, AC-040
- Arquivos: src/lib/relatorios/kpis-tempo-fabril.ts, src/lib/relatorios/dedup-status-atendimento.ts, src/lib/relatorios/dedup-status-atendimento.test.ts
- Esforço: alto
- Notas: regra pura nova, testável com `node --test` (ASM-001, imports relativos com extensão). Recebe os blocos e os atendimentos fabris do profissional e devolve, por bloco, os minutos a descontar. **Medir na mesma moeda (ASM-008):** aplicar `calcularMinutosStatusNaJornada` sobre o intervalo de interseção, não sobre a interseção crua — o bloco entrou capado pela jornada e o atendimento não. Unir os intervalos dos atendimentos antes de intersectar, senão dois atendimentos sobrepostos descontam o mesmo minuto duas vezes (AC-040). `Math.max(0, ...)` no resultado. Ponto de aplicação: `tempoStatusMin` em `calcularKPIs`, antes da soma em `tempoFabrilMin` — e também em `somarTempoStatusNoIntervalo`, usado no recorte semanal, senão o semanal e o total divergem.

## T-030 — A conferência mostra o desconto [concluida]
- Refs: AC-041
- Arquivos: src/lib/relatorios/kpis-tempo-fabril.ts, src/components/features/relatorios/TabelaTempoFabril.tsx, src/lib/relatorios/markdown-tempo-fabril.ts, src/lib/relatorios/pdf-tempo-fabril.ts, test/ui/dedup-visivel.test.ts
- Esforço: medio
- Notas: o detalhe do bloco leva os minutos descontados junto do motivo e da marca de expirado que T-025/T-026/T-027 já colocaram lá. As três superfícies (tela, Markdown, PDF) na mesma tarefa porque T-027 acabou de provar que exportar pela metade é o modo de falha desta feature. No PDF, cabe na coluna que já existe — não abrir coluna nova, as larguras já foram rebalanceadas para 178mm. Depende de T-029.

## T-031 — O desconto não reescreve o passado [concluida]
- Refs: AC-043
- Arquivos: src/lib/relatorios/dedup-status-atendimento.ts, src/lib/relatorios/dedup-status-atendimento.test.ts, src/lib/relatorios/kpis-tempo-fabril.ts
- Esforço: baixo
- Notas: decisão do dono em 12/08 — a contagem dupla anterior vira erro conhecido e datado, não defeito a corrigir. `INICIO_DO_DESCONTO` = 13/08 00:00 em São Paulo: o dia 12 foi regime misto (migration aplicada ~15:00 UTC) e cortar no meio dele produziria um relatório diário com duas regras dentro. A checagem usa o início REAL do bloco, nunca o recortado pela janela do relatório — usar o recortado faria a data de corte depender do filtro escolhido na tela, e o mesmo bloco seria descontado ou não conforme o período consultado. Aplicado nos dois pontos de cálculo (total e recorte semanal). O teste trava a constante: mudá-la muda números de relatório retroativamente, então não pode ser ajustada sem quebrar teste.
