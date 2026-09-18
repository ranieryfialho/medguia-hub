# RFC: CRM de Vendas — Pipeline Kanban, Régua de Follow-up e Responsável Comercial

| Campo | Valor |
|-------|-------|
| **Impacto** | **ALTO** — nova rota operada diariamente pela recepção, 5 colunas novas em `vendas`, tabela nova de histórico comercial, mudança de semântica num campo que o relatório de vendas já lê, e uma decisão de reuso que define se o projeto passa a ter um ou dois Kanbans para manter. |
| **Status** | **DECIDED** — Opção 2 aprovada em 2026-09-18; decisões A–F respondidas; ver *Outcome* |
| **Driver** | @Raniery |
| **Approver** | @Dr. Felipe (dono) |
| **Contributors** | Engenharia (MedGuia Hub), Gestão Comercial, Coordenação de Recepção |
| **Informed** | Recepção, fisioterapeutas, médicos parceiros |
| **Due Date** | TBD — sugerido decidir em até 1 semana |
| **Resources** | [PRD 008](../prds/008-crm-de-vendas-e-orcamentos-kanban-e-follow-up.md) · [RFC 004](004-venda-em-consultorio-e-relatorio-historico-de-vendas.md) · [RFC 006](006-foto-do-paciente-google-drive-e-avatar.md) · [RFC 002](002-ciclo-de-vida-dos-status-personalizados.md) |
| **Created** | 2026-09-18 |
| **Last Updated** | 2026-09-18 — rev. 2: medição de produção executada (Ação 1), achado 7 adicionado (o funil não registra perda), decisões A–F respondidas e *Outcome* preenchido |

---

## Sumário Executivo

O PRD 008 pede cinco coisas: um quadro Kanban em 3 colunas para orçamentos, uma régua de follow-up com SLA visual, um responsável comercial nominal, um histórico de interações por oportunidade e KPIs de funil.

A necessidade é real e o desenho funcional do PRD está correto. O que muda o enquadramento é o levantamento do código — em **seis** pontos que o PRD não considera:

> **1. O Kanban que o PRD pede para construir já existe neste projeto — para contatos.** A rota `/contatos` tem quadro completo em produção: drag-and-drop **nativo HTML5** ([`KanbanCard.tsx:27-30`](../../src/components/features/contatos/KanbanCard.tsx#L27-L30) e [`KanbanColumn.tsx:79-95`](../../src/components/features/contatos/KanbanColumn.tsx#L79-L95)), update **otimista com rollback** por `router.refresh()` + toast ([`KanbanContatos.tsx:629-676`](../../src/components/features/contatos/KanbanContatos.tsx#L629-L676)), **paginação por coluna** (`CONTATOS_KANBAN_PAGE_SIZE = 30`, [`contatos-kanban-data.ts:46`](../../src/lib/contatos-kanban-data.ts#L46)), rota de API com board + página de coluna ([`/api/contatos/kanban`](../../src/app/api/contatos/kanban/route.ts)), **fallback mobile por botões ◀ ▶** (`moverEsquerda`/`moverDireita`, [L690-698](../../src/components/features/contatos/KanbanContatos.tsx#L690-L698)) e **responsável por card** (`contatos_base.responsavel_id`). São ~1.450 linhas já escritas, já depuradas e já rodando. O PRD descreve tudo isso como construção nova.

> **2. Não existe nenhuma biblioteca de drag-and-drop no projeto — e isso é uma escolha, não uma lacuna.** `grep` por `dnd|drag|sortable` no [`package.json`](../../package.json) retorna zero. O Kanban de contatos resolve DnD com a API nativa do HTML5, gated por `isDesktop`, com botões como caminho primário no mobile. Qualquer proposta de adicionar `@dnd-kit` para o CRM de vendas cria **dois padrões de DnD** no mesmo produto — e exige validar compatibilidade com Next 16.2.1 / React 19.2.4.

> **3. O "Modal de Formalização de Venda" da coluna Fechado já existe — e já é mais rigoroso que o PRD.** [`atualizarStatusVenda`](../../src/actions/vendas.ts#L830) já valida a soma dos pagamentos contra o total com tolerância de R$ 0,01 ([L850-858](../../src/actions/vendas.ts#L850-L858)) e já **bloqueia** a confirmação sem comprovante ([L889-894](../../src/actions/vendas.ts#L889-L894)); [`BtnAtualizarStatusVenda`](../../src/components/features/vendas/BtnAtualizarStatusVenda.tsx) já implementa o modal de upload e o modal de recusa. As duas "NUNCA PODE" financeiras do PRD **já estão atendidas no servidor**. O que falta é a superfície no quadro — não a regra.

> **4. A objeção, hoje, significa o oposto do que o PRD supõe.** [`criarVenda:331`](../../src/actions/vendas.ts#L331) grava `objecao_motivo_id` **somente quando o status é `orcamento_pendente`** — com comentário explícito de "defesa em profundidade". Na recusa, [`atualizarStatusVenda:877`](../../src/actions/vendas.ts#L877) grava `motivo_recusa` (**texto livre**) e **não toca** em `objecao_motivo_id`. Ou seja: no sistema atual, objeção = *"por que ainda não fechou"*; o PRD quer objeção = *"por que perdeu"*. Implementar a "NUNCA PODE" do PRD sem resolver isso coloca duas semânticas na mesma coluna — e o [relatório de vendas](../../src/app/(painel)/relatorios/vendas/page.tsx#L150) já lê `objecao_motivo_nome`, então a mudança **retro-reinterpreta dado histórico**.

> **5. `status_follow_up` como coluna persistida com `CHECK` (§6.1 do PRD) nasce errada toda meia-noite.** É valor derivado de data: um card `vence_hoje` vira `atrasado` sozinho na virada do dia, sem que nenhum `UPDATE` aconteça. O PRD não define quem reescreve a coluna. O projeto já pagou exatamente essa conta — o teto de 2h dos status personalizados precisou de `pg_cron` de fallback para manter estado derivado coerente ([RFC 002](002-ciclo-de-vida-dos-status-personalizados.md)). Aqui o cálculo é barato e não precisa de job nenhum: é `data_proximo_follow_up` comparada com hoje.

> **6. A tabela `venda_interacoes_crm` do PRD não declara RLS — e o projeto já tem a cicatriz desse erro.** [`objecoes_orcamento_rls_fix.sql`](../../database/objecoes_orcamento_rls_fix.sql) documenta o caso com todas as letras: *"a tabela foi criada com Row Level Security habilitado (padrão do projeto para tabelas novas) e sem nenhuma policy — por isso a API não retornava nenhuma linha, apesar dos dados existirem (visível só via service role)"*. O SQL do PRD (§6.2) não tem uma linha de RLS. O modo de falha não é erro: é **histórico do lead sempre vazio na tela, cheio no banco**.

> **7. (rev. 2 — medido em produção) O funil não registra perda, e por isso o KPI de conversão do PRD nasceria mentindo.** São **217 vendas confirmadas contra 3 orçamentos recusados**. A fórmula do §1.2 do PRD — `Fechado / (Fechado + Perdido)` — devolveria **98,6% de conversão**, número que ninguém na clínica acredita. A explicação está na coluna Pendente: **79 cards, R$ 238.650 represados, mediana de 37 dias parados, 40 deles (51%) acima de 30 dias**. Orçamento que morre não é marcado como recusado — ele simplesmente fica pendente para sempre. Ou seja: a coluna **Perdido não é um detalhe do quadro, é a peça que falta para qualquer métrica comercial fazer sentido** — e o valor real da entrega não é o Kanban, é passar a registrar a perda.

**Recomendação: Opção 2 — extrair o núcleo do Kanban de contatos para um componente compartilhado e montar o CRM de vendas sobre o fluxo de status que já existe.** Interações em tabela dedicada com RLS explícita, SLA **calculado** (nunca persistido), `responsavel_comercial_id` novo e independente de `profissional_id`, e a semântica da objeção resolvida por decisão explícita do Approver (Decisão **B**) antes de qualquer migration.

---

## Background

### Situação atual

**O ciclo comercial já existe — falta a superfície de gestão.** A tabela `vendas` opera três status ([`lib/vendas.ts:2-4`](../../src/lib/vendas.ts#L2-L4)): `venda_confirmada`, `orcamento_pendente`, `orcamento_recusado`. As transições passam por `atualizarStatusVenda`, com as validações descritas no ponto 3 do sumário.

| Peça que o PRD pede | Já existe? | Onde |
|---------------------|-----------|------|
| 3 status canônicos | ✅ Completo | [`lib/vendas.ts`](../../src/lib/vendas.ts) |
| Validação de soma de pagamentos na confirmação | ✅ Completo | [`vendas.ts:850-858`](../../src/actions/vendas.ts#L850-L858) |
| Comprovante obrigatório na confirmação | ✅ Completo | [`vendas.ts:889-894`](../../src/actions/vendas.ts#L889-L894) |
| Catálogo de objeções (8 seeds) | ✅ Completo | [`objecoes_orcamento_migration.sql`](../../database/objecoes_orcamento_migration.sql) |
| Congelamento do nome da objeção | ✅ Completo | `vendas.objecao_motivo_nome` |
| Modal de recusa | ⚠️ Existe, mas com **texto livre**, não com objeção | [`BtnAtualizarStatusVenda.tsx`](../../src/components/features/vendas/BtnAtualizarStatusVenda.tsx) |
| Quadro Kanban com DnD e paginação por coluna | ⚠️ Existe **para contatos** | [`KanbanContatos.tsx`](../../src/components/features/contatos/KanbanContatos.tsx) |
| Responsável por card + filtro "sem responsável" | ⚠️ Existe **para contatos** | `contatos_base.responsavel_id` |
| Histórico de anotações por card | ⚠️ Existe **para contatos** | `notas_contato` ([`contatos.ts:468`](../../src/actions/contatos.ts#L468)) |
| Template de WhatsApp com 1 clique | ⚠️ Existe, duplicado em 4 lugares | [`kanban-utils.ts:87-93`](../../src/components/features/contatos/kanban-utils.ts#L87-L93), [`BtnWhatsApp`](../../src/components/features/shared/BtnWhatsApp.tsx), `SeletorTemplateWhatsApp`, `SeletorTemplateAniversario` |
| Responsável **comercial** em `vendas` | ❌ Não existe | — |
| Data e SLA de próximo follow-up | ❌ Não existe | — |
| Interações comerciais com canal e desfecho | ❌ Não existe | — |
| KPIs de funil (conversão, ticket, represado) | ❌ Não existe | — |

**Onde os orçamentos pendentes vivem hoje.** Em `/vendas`, misturados com o histórico faturado, num Server Component de 588 linhas com filtros e paginação por URL ([`vendas/page.tsx`](../../src/app/(painel)/vendas/page.tsx)). O badge `Pendente` é só cor ([L14](../../src/app/(painel)/vendas/page.tsx#L14)) — não há ordenação por urgência, contagem de dias parados nem valor represado.

**Permissões.** O grupo `Comercial` de [`modulos.ts`](../../src/lib/modulos.ts#L84-L92) tem 4 chaves (`comercial:vendas`, `:produtos`, `:objecoes`, `:relatorio_vendas`). O gate é de aplicação, via `requireModulo()` ([`guard.ts:22`](../../src/lib/guard.ts#L22)) — com a regra de compatibilidade de que `modulos_liberados` **vazio significa acesso total** ([L26](../../src/lib/guard.ts#L26)). Isso importa diretamente para a "NUNCA PODE" do PRD sobre não expor métricas financeiras: hoje, um usuário sem módulos configurados vê tudo.

### O problema

1. **Não há fila de trabalho comercial.** A pergunta *"o que eu preciso fazer hoje para não perder venda?"* não tem tela. A resposta está na memória de quem atendeu.
2. **Não há accountability de fechamento.** `vendas.profissional_id` é o profissional **clínico**. Quem negocia é a recepção. Não existe campo que registre isso — nem para cobrar, nem para reconhecer.
3. **O que o paciente respondeu não entra no sistema.** Fica no WhatsApp pessoal de quem ligou. Na troca de turno, perde-se.
4. **Orçamento recusado só guarda texto livre.** `motivo_recusa` não é agregável. O catálogo de 8 objeções existe e está subutilizado justamente no momento em que mais valeria — a perda.
5. **A recuperação de perdidos não existe** como processo, só como intenção.

### Por que agora

1. **A régua só produz dado a partir do momento em que existe.** Follow-up não é retroativo: cada semana sem a régua é uma safra de orçamentos que nunca terá histórico de contato. O PRD já colocou backfill fora de escopo.
2. **A janela de reuso está aberta e vai fechar.** O Kanban de contatos está estável agora. Se o CRM de vendas nascer como cópia, a extração vira refatoração de **duas** telas em produção em vez de uma — e o custo passa a ser permanente (toda melhoria de Kanban feita duas vezes).
3. **A decisão da objeção (Decisão B) fica mais cara a cada mês.** Quanto mais vendas gravarem `objecao_motivo_id` com a semântica atual, maior o volume a reinterpretar se a semântica mudar depois.

### O que acontece se não decidirmos

Os orçamentos pendentes continuam dispersos na listagem, a cobrança segue acontecendo por lembrança pessoal, `motivo_recusa` continua acumulando texto livre não agregável, e a próxima tela de quadro do projeto nascerá como terceira cópia do mesmo Kanban.

---

## Dados Relevantes

**Levantamento de código (18/09/2026)** — verificado no repositório:

| Achado | Evidência | Verificado |
|--------|-----------|-----------|
| Kanban completo já existe para contatos (~1.450 linhas) | `KanbanContatos.tsx` (1.063) + `KanbanColumn` (171) + `KanbanCard` (157) + rota de API (60) | ✅ |
| DnD é nativo HTML5; zero dependências de DnD no projeto | `dataTransfer` em [`KanbanCard.tsx:29`](../../src/components/features/contatos/KanbanCard.tsx#L29); `grep -i "dnd\|drag\|sortable" package.json` → 0 | ✅ |
| Update otimista com rollback e log de diagnóstico já implementado | [`KanbanContatos.tsx:629-688`](../../src/components/features/contatos/KanbanContatos.tsx#L629-L688) | ✅ |
| Paginação por coluna já resolvida | `CONTATOS_KANBAN_PAGE_SIZE = 30` | ✅ |
| Soma de pagamentos já validada com tolerância de R$ 0,01 | [`vendas.ts:856`](../../src/actions/vendas.ts#L856) | ✅ |
| Comprovante já obrigatório para confirmar venda | [`vendas.ts:889-894`](../../src/actions/vendas.ts#L889-L894) | ✅ |
| Objeção só é gravada quando status = `orcamento_pendente` | [`vendas.ts:331`](../../src/actions/vendas.ts#L331) | ✅ |
| Recusa grava texto livre e ignora a objeção | [`vendas.ts:877`](../../src/actions/vendas.ts#L877) | ✅ |
| Relatório de vendas já consome `objecao_motivo_nome` | [`relatorios/vendas/page.tsx:150`](../../src/app/(painel)/relatorios/vendas/page.tsx#L150) | ✅ |
| Tabela nova sem policy retorna zero linhas, sem erro | [`objecoes_orcamento_rls_fix.sql`](../../database/objecoes_orcamento_rls_fix.sql) | ✅ |
| Padrão de RLS a copiar (leitura autenticados / escrita gestores) | [`venda_tags_migration.sql:20-45`](../../database/venda_tags_migration.sql#L20-L45) | ✅ |
| `listarVendas` é **código morto** (zero consumidores) e seleciona `profiles(nome)` — o resto do projeto usa `full_name` | [`vendas.ts:713`](../../src/actions/vendas.ts#L713), [L749](../../src/actions/vendas.ts#L749) | ✅ |
| Geração de link `wa.me` duplicada em 4 arquivos | `grep "wa.me" src` | ✅ |
| `vendas` não tem `criado_por` — o fallback de responsável precisa vir da sessão | `grep criado_por database/vendas_*.sql` → 0 | ✅ |

### Medição de produção (Ação 1 — executada em 18/09/2026)

Consulta somente-leitura via PostgREST com service role, sobre `vendas`, `itens_venda` e `profiles`.

| Métrica | Valor |
|---------|-------|
| Vendas no total | 299 |
| `venda_confirmada` | 217 |
| `orcamento_pendente` | **79** |
| `orcamento_recusado` | **3** |
| Valor represado na coluna Pendente | **R$ 238.650,00** |
| Ticket médio do pendente | R$ 3.020,89 |
| Pendentes sem itens (valor zero) | 0 |
| Idade dos pendentes — mín / mediana / média / máx | 0 / **37** / 41,0 / 128 dias |
| Estagnados >30d / >90d / >365d | **40** / 8 / 0 |
| Pendentes com objeção gravada | 25 de 79 |
| Recusadas com `objecao_motivo_id` | **0 de 3** |
| Recusadas com `motivo_recusa` (texto livre) | 2 de 3 |
| Equipe (`profiles.role`) | 12 gestor · 10 fisioterapeuta · 10 médico · **1 recepcionista** |

**O que esses números mudam nesta RFC:**

1. **Confirmam a Suposição 1** (dezenas, não milhares). `CONTATOS_KANBAN_PAGE_SIZE = 30` serve como ponto de partida; virtualização não é necessária.
2. **Revelam o achado 7** — a conversão aparente de 98,6% é artefato de não se registrar perda. A métrica só passa a valer depois que a coluna Perdido for usada de verdade.
3. **Tornam a Decisão E imediata:** 51% do quadro nasce em alerta crítico. Não é cenário futuro, é o estado do dia 1.
4. **Enfraquecem o argumento histórico da Decisão B.** A justificativa original — "não reinterpretar dado histórico" — vale sobre 25 pendentes e 3 recusadas, volume pequeno. A decisão passou a repousar no argumento conceitual (são duas perguntas comerciais distintas), não no custo de migração.
5. **Esvaziam a Decisão F.** Com **uma** recepcionista cadastrada, não existe carteira para redistribuir em lote.

---

## Suposições

| # | Suposição | Owner | Confiança | Gatilho de invalidação |
|---|-----------|-------|-----------|------------------------|
| 1 | ~~O volume de orçamentos pendentes é da ordem de dezenas, não de milhares~~ **Confirmada em 18/09: 79 cards** | Gestão | **Alta** (medida) | Se passar de ~300 cards abertos, a coluna Pendente precisa de virtualização, não só de paginação |
| 2 | As 3 colunas do PRD bastam — não haverá colunas customizáveis como em contatos (`kanban_colunas_contatos`) | @Dr. Felipe | **Média** | Se a gestão quiser colunas próprias (ex.: "Aguardando exame"), o componente extraído precisa nascer parametrizável desde já — ver Decisão **A** |
| 3 | Todo card do CRM é uma linha de `vendas`; não existe oportunidade sem orçamento lançado | Gestão | **Alta** | Se surgir "lead sem orçamento", o card deixa de ser `vendas` e vira outra entidade — muda o modelo inteiro |
| 4 | Vendas existentes podem ficar com `responsavel_comercial_id` nulo (bucket "Sem responsável") sem distorcer métrica | @Dr. Felipe | **Alta** | Se a gestão quiser atribuição retroativa, é backfill manual — não coberto aqui |
| 5 | Registrar interação **não** exige agendar o próximo contato | Gestão | **Alta** | Já é "NUNCA PODE" explícita do PRD |
| 6 | O SLA opera em **dias corridos**, não em dias úteis | Gestão | **Baixa** | O PRD mistura os dois ("D+1 próximo dia útil", "X dias úteis", mas também "48 horas" e "30 dias" corridos) — ver Decisão **C** |
| 7 | O template de WhatsApp pode começar fixo em código, com personalização depois | Recepção | **Média** | Se a personalização por usuário for requisito de lançamento, entra tabela de templates e o escopo cresce |
| 8 | Ninguém depende hoje do comportamento atual de `objecao_motivo_id` em relatório fora do sistema | Engenharia | **Média** | Se houver planilha externa lendo esse campo, a Decisão **B** precisa ser comunicada antes |

---

## Critérios de Decisão

Definidos **antes** das opções.

| # | Critério | Peso | Tipo |
|---|----------|------|------|
| C1 | **Nenhuma regressão nas travas financeiras** — soma de pagamentos e comprovante obrigatório continuam validados **no servidor**, em todo caminho novo | 5 | **Must-have** |
| C2 | **Nenhum caminho novo que retorne dado incompleto sem erro** — RLS declarada explicitamente em toda tabela nova; nenhuma coluna derivada persistida sem dono de escrita | 5 | **Must-have** |
| C3 | **Semântica da objeção resolvida antes da migration**, sem reinterpretar dado histórico por acidente | 5 | **Must-have** |
| C4 | **`profissional_id` e `responsavel_comercial_id` independentes**, sem sobrescrita de um pelo outro | 5 | **Must-have** |
| C5 | **Custo de manutenção do Kanban** — quantas cópias da mesma mecânica o projeto passa a manter | 4 | Alta |
| C6 | **Usabilidade no balcão** — registrar contato em poucos segundos e funcionar no celular da recepção | 4 | Alta |
| C7 | **Reversibilidade** — quanto custa desligar o módulo se a equipe não adotar | 3 | Média |

**Regra de decisão:** a opção recomendada satisfaz **todos** os Must-have e pontua melhor em C5 e C6. Onde nenhuma opção vence em tudo, o trade-off é declarado explicitamente.

---

## Opções Consideradas

### Opção 1: Kanban dedicado de vendas, construído do zero (o PRD literal)

**Descrição.** Nova rota `/vendas/crm` com componentes próprios (`KanbanVendas`, `CardOportunidade`, colunas, toolbar), sem tocar no Kanban de contatos. Possivelmente com biblioteca de DnD (`@dnd-kit`), por conta do requisito de "drag-and-drop fluido".

**Como funciona**
1. Migration com as colunas novas em `vendas`, `venda_interacoes_crm` e o trigger de resumo, como no §6 do PRD.
2. Componentes de quadro novos, específicos de venda.
3. Modais de fechamento e de perda novos, chamando `atualizarStatusVenda`.

**Prós**
- Caminho mais curto até a primeira tela: nada a refatorar antes de começar.
- Zero risco de regressão em `/contatos` — aquele código não é tocado.
- Liberdade total para o card rico que o PRD desenha.

**Contras**
- O projeto passa a manter **dois Kanbans** com a mesma mecânica (DnD, otimismo, paginação por coluna, fallback mobile). Toda correção vira duas correções — e o [RFC 006](006-foto-do-paciente-google-drive-e-avatar.md), com o avatar reimplementado em 8 telas, documenta o custo real dessa escolha.
- Se entrar `@dnd-kit`, são **dois padrões de DnD** e uma dependência nova a validar contra Next 16.2.1 / React 19.2.4.
- Reimplementar otimismo e rollback significa reencontrar os bugs que `KanbanContatos` já resolveu — incluindo o log de diagnóstico de falha de move ([L678-688](../../src/components/features/contatos/KanbanContatos.tsx#L678-L688)), que só existe porque o problema apareceu em campo.

**Custo estimado:** **GRANDE** — ~3 a 4 semanas · Risco: **MÉDIO** (baixo de regressão, alto de dívida)

---

### Opção 2: Extrair o núcleo do Kanban de contatos e montar o CRM sobre o fluxo de status existente ⭐ (Recomendada)

**Descrição.** Extrair de `KanbanContatos` a mecânica genérica — coluna, card, DnD nativo, move otimista com rollback, paginação por coluna, fallback ◀ ▶ no mobile — para um componente compartilhado, parametrizado por colunas e por uma função de move. `/contatos` passa a consumir esse componente (comportamento idêntico); `/vendas/crm` nasce como segundo consumidor, com card e modais próprios de venda. O move para Fechado/Perdido **não** escreve direto: abre o modal e delega a `atualizarStatusVenda`, que já carrega as travas financeiras.

**Como funciona**
1. **Extração sem mudança de comportamento:** `KanbanBoard` genérico + `useKanbanBoard`. `/contatos` migra primeiro e serve de teste de regressão.
2. **Migration aditiva** em `vendas`: `responsavel_comercial_id` (FK `profiles` com `ON DELETE SET NULL`, atendendo à "NUNCA PODE" do PRD sobre preservar histórico), `data_proximo_follow_up date`, `data_ultimo_contato_crm timestamptz`, `total_interacoes_crm integer`, `data_reabertura_crm timestamptz`. **Sem `status_follow_up`** — ver ponto 5 do sumário.
3. **`venda_interacoes_crm`** com `CHECK (data_contato <= now())` — a "NUNCA PODE" de não registrar contato no futuro vira trava de banco, não de UI — e **RLS explícita** no padrão de [`venda_tags_migration.sql`](../../database/venda_tags_migration.sql#L20-L45).
4. **SLA calculado, nunca persistido:** `calcularStatusFollowUp(dataProximo, dataUltimo, hoje)` em `src/lib/crm-vendas.ts`, com teste unitário nos quatro estados e na virada de dia.
5. **Fechado/Perdido reusam `atualizarStatusVenda`.** Perdido ganha os campos de objeção conforme a Decisão **B**; a obrigatoriedade da objeção entra **na action**, não só no modal — mesma lição do RFC 003 sobre regra que vive só na UI.
6. **Interação** por Server Action, com o trigger de resumo do §6.3 do PRD (`total_interacoes_crm`, `data_ultimo_contato_crm`, `data_proximo_follow_up`).
7. **`enviarWhatsApp(telefone, mensagem)`** unificado em `src/lib/whatsapp.ts`, absorvendo as 4 duplicações atuais.

**Prós**
- Um Kanban, dois consumidores. C5 resolvido de vez, e a próxima tela de quadro fica barata.
- Zero reimplementação de otimismo, rollback, paginação e mobile — justamente a parte que mais custa a acertar.
- As travas financeiras ficam onde já estão (C1), sem caminho paralelo que possa divergir.
- `/contatos` vira teste de regressão vivo da extração: se quebrar, quebra visível e cedo, antes do CRM existir.
- Reversível: desligar a chave `comercial:crm` esconde a rota sem tocar em `vendas`; as colunas novas são aditivas e nuláveis (C7).

**Contras**
- A extração é trabalho que **não aparece na tela** — e mexe numa rota em produção antes de entregar a nova.
- Exige disciplina para o componente genérico não virar uma coleção de `if (isVendas)`.
- `KanbanContatos` tem 1.063 linhas com muita lógica específica de contato; separar o genérico do específico é a parte difícil da estimativa, e é onde ela pode estourar.

**Custo estimado:** **GRANDE** — ~4 a 5 semanas (≈1 de extração + ≈3 a 4 de CRM) · Risco: **MÉDIO** (concentrado na extração, mitigado por migrar `/contatos` primeiro)

---

### Opção 3: Fila de follow-up sobre a lista `/vendas`, sem quadro

**Descrição.** Sem Kanban. `/vendas` ganha uma aba "Em negociação" com os pendentes ordenados por urgência de follow-up, o registro de interação, o responsável comercial e os KPIs. As transições continuam pelos botões que já existem.

**Como funciona**
1. Mesma migration da Opção 2 (colunas novas + `venda_interacoes_crm`).
2. Sem componente de quadro: tabela ordenada por `data_proximo_follow_up`, com badge de SLA.
3. Botão "+ Interação" na linha, com modal enxuto.

**Prós**
- Entrega o **valor central** — cadência, histórico, responsável, accountability — pelo menor custo do conjunto.
- Zero dívida de Kanban: nada duplicado, nada extraído.
- Melhor experiência mobile entre as opções: lista é nativamente responsiva.

**Contras**
- Não entrega a leitura visual de funil que o PRD abre pedindo (*"bater o olho e ver"*). Para a diretoria, é exatamente o que motivou o pedido.
- Sem DnD, mudar status continua com o número de cliques atual.
- Risco de virar entrega intermediária que nunca evolui — e o Kanban voltar como pedido daqui a um trimestre.

**Custo estimado:** **MÉDIO** — ~2 semanas · Risco: **BAIXO**

---

### Opção 4: Não fazer nada

**Descrição.** Manter `/vendas` como está; a cobrança segue por iniciativa individual.

**Prós**
- Custo zero; nenhuma migration em tabela crítica; nenhuma tela nova para treinar.

**Contras**
- Cada semana sem régua é uma safra de orçamentos sem histórico de contato — perda permanente, não adiável.
- `motivo_recusa` continua acumulando texto livre não agregável.
- Não há como responder quanto está represado nem quem está cobrando o quê.

**Custo estimado:** PEQUENO (agora) / GRANDE (acumulado)

---

## Comparação das Opções

| Critério | Opção 1 (do zero) | **Opção 2 (extrair)** | Opção 3 (lista) | Opção 4 (nada) |
|----------|-------------------|------------------------|-----------------|----------------|
| C1 Travas financeiras no servidor | ✅ reusa a action | ✅ reusa a action | ✅ | ✅ inalterado |
| C2 Sem dado incompleto silencioso | ⚠️ depende de corrigir RLS e SLA do PRD | ✅ explícito no desenho | ✅ | ✅ |
| C3 Semântica da objeção | ⚠️ não resolvida pelo PRD | ✅ Decisão **B** antes da migration | ✅ Decisão **B** | ❌ problema permanece |
| C4 Clínico ≠ comercial | ✅ | ✅ | ✅ | ❌ |
| C5 Custo de manutenção do Kanban | ❌ dois Kanbans | ✅ um, dois consumidores | ✅ nenhum | ✅ |
| C6 Usabilidade no balcão | ✅ | ✅ herda o mobile de contatos | ⚠️ sem leitura de funil | ❌ |
| C7 Reversibilidade | ✅ | ✅ | ✅ | — |
| Esforço | ~3–4 semanas | ~4–5 semanas | ~2 semanas | 0 |
| Risco em produção | Médio | Médio (concentrado e cedo) | Baixo | — |

**Recomendada: Opção 2.** É a única que satisfaz todos os Must-have **e** não deixa o projeto com duas implementações da mesma mecânica. A semana extra de extração compra a eliminação de um custo recorrente.

**Se a decisão for pelo prazo**, a Opção 3 é a segunda melhor: entrega o valor central em metade do tempo e sua migration é **a mesma** da Opção 2 — o quadro pode vir depois sem retrabalho de banco. A Opção 1 é a única que não recomendo em nenhum cenário: custa quase o mesmo que a 2 e deixa dívida permanente.

---

## Decisões do Approver — **RESPONDIDAS EM 18/09/2026**

| # | Decisão | Resposta | Consequência para a implementação |
|---|---------|----------|-----------------------------------|
| **A** | Colunas fixas ou configuráveis | **Fixas na V1** (decidido pelo Driver, sem objeção do Approver) | O `KanbanBoard` extraído recebe as colunas por prop; não entra tabela `kanban_colunas_vendas`. As 3 colunas espelham o `CHECK` de `vendas.status` |
| **B** | Semântica da objeção | **Dois campos separados** | `objecao_motivo_id` fica **intocado** (objeção de negociação). A perda ganha `objecao_perda_motivo_id` + `objecao_perda_nome` (congelado) + `objecao_perda_observacao`, alimentados pelo mesmo catálogo `objecoes_orcamento`. Nenhuma linha histórica é reinterpretada. A "NUNCA PODE" do PRD passa a valer sobre o campo novo, validada **na action** |
| **C** | Dias corridos ou úteis | **Dias corridos** (decidido pelo Driver, sem objeção do Approver) | `calcularStatusFollowUp` opera em dias corridos; sem tabela de feriados, sem dependência de calendário. D+1 de sexta cai no sábado e aparece como "vence hoje" |
| **D** | Acesso do fisioterapeuta | **Fisioterapeuta não acessa o CRM na V1** | **Chave única `comercial:crm`**, liberada a `gestor`, `master` e recepção — `comercial:crm_completo` **não é mais necessária**. O fisio continua criando orçamento em `/vendas/nova` e continua podendo ser escolhido como responsável comercial, mas não abre o quadro. **Consequência:** a terceira persona do PRD (§Usuários, "Fisioterapeuta / Avaliador") fica fora da V1, e o requisito §5.2 de o fisio "manter-se como responsável e acompanhar" vira acompanhamento sem tela própria |
| **E** | Estagnação aos 30 dias | **Somente sugestão visual** | Badge + filtro "Estagnados >30 dias". Nenhum job, nenhuma escrita automática de status. Os 40 cards vencidos entram no quadro como estão, sinalizados, e a triagem é decisão humana |
| **F** | Reatribuição em lote | **Fora da V1** | Só reatribuição individual por card. Reforçado pela medição: 1 recepcionista cadastrada |

<details>
<summary>Racional original apresentado antes da decisão (mantido para auditoria)</summary>

| # | Decisão | Por que precisa ser sua | Recomendação do Driver |
|---|---------|--------------------------|------------------------|
| **A** | As 3 colunas são fixas em código ou configuráveis, como em contatos (`kanban_colunas_contatos`)? | Define se o componente extraído nasce parametrizável e se entra tabela de colunas | **Fixas na V1.** As colunas espelham `vendas.status`, que tem `CHECK` no banco — coluna customizada exigiria status novo |
| **B** | **Semântica da objeção.** Hoje objeção = "por que ainda não fechou" (só em pendente); o PRD quer "por que perdeu". Opções: (i) dois campos separados — objeção de negociação e objeção de perda; (ii) migrar para "por que perdeu" e reinterpretar o histórico; (iii) manter como está e estruturar `motivo_recusa` | Muda dado que o relatório de vendas já lê e afeta comparação histórica | **(i) — dois campos.** `objecao_motivo_id` fica como está; a perda ganha `objecao_perda_motivo_id` + nome congelado. Nada histórico é reinterpretado, e a "NUNCA PODE" do PRD passa a valer sobre o campo novo |
| **C** | SLA em **dias corridos** ou **dias úteis**? | Muda o cálculo, os testes e o que a recepção vê na segunda de manhã | **Dias corridos.** Mais simples e auditável; o D+1 de sexta cai no sábado e aparece como "vence hoje" — aceitável e visível, ao contrário de um cálculo de feriado que ninguém consegue conferir |
| **D** | Fisioterapeuta vê o pipeline **inteiro** ou só as oportunidades das avaliações dele? (o PRD deixa "opcional") | É a "NUNCA PODE" sobre exposição de métrica financeira — e hoje `modulos_liberados` vazio significa acesso total | **Duas chaves:** `comercial:crm` (só as próprias) e `comercial:crm_completo` (pipeline e KPIs da clínica). Sem isso, a trava do PRD não é implementável com o modelo de permissão atual |
| **E** | Estagnação aos 30 dias: **sugestão visual** (filtro + badge) ou **movimentação automática** para Perdido? | Movimentação automática escreve em venda sem ninguém decidir | **Sugestão visual apenas.** Automatizar perda contamina a taxa de conversão com decisão de máquina |
| **F** | Reatribuição em lote (§5.3) entra na V1? | É a parte com maior custo de UI e menor frequência de uso (férias, licença) | **Fora da V1.** A reatribuição individual por card cobre o dia a dia; o lote entra quando houver caso real |

</details>

---

## Escopo Explicitamente Fora desta RFC

- **Backfill** de `responsavel_comercial_id` em vendas históricas (o PRD já excluiu).
- **Personalização de templates** de WhatsApp por usuário (§4.3, segunda metade) — a V1 usa template fixo em código.
- **Aba de histórico comercial em `/pacientes/[id]`** (§Sugestões, item 5) — depende do CRM existir primeiro.
- **Badge no sino de notificações** (§Sugestões, item 4) — a tabela `notificacoes` existe e o gancho é barato, mas entra depois da adoção da régua.
- **Exportação do funil** (matriz de permissões) — `jspdf` e `xlsx` já estão no projeto; vira trabalho próprio quando houver o que exportar.
- **Correção de `listarVendas`** (código morto com `profiles(nome)` inexistente) — não bloqueia nada, mas **não deve ser estendida** por este módulo. Registrada aqui para não ser descoberta depois como "bug do CRM".

---

## Itens de Ação

| # | Ação | Owner | Prazo | Status |
|---|------|-------|-------|--------|
| 1 | ~~Medir em produção: total de `orcamento_pendente`, idade média e valor represado~~ | @Raniery | 18/09/2026 | ✅ **CONCLUÍDO** — ver *Medição de produção* |
| 2 | ~~Responder as Decisões **A–F**~~ | @Dr. Felipe | 18/09/2026 | ✅ **CONCLUÍDO** |
| 3 | Validar com a recepção o vocabulário de canal e desfecho da interação | Coord. Recepção | Antes da migration | NÃO INICIADO |
| 4 | Extrair `KanbanBoard` genérico e migrar `/contatos` sem mudança de comportamento | Engenharia | Sprint 1 | NÃO INICIADO |
| 5 | Migration aditiva em `vendas` (incl. campos `objecao_perda_*` da Decisão **B**) + `venda_interacoes_crm` **com RLS explícita** e `CHECK (data_contato <= now())` | Engenharia | Sprint 2 | NÃO INICIADO |
| 6 | `calcularStatusFollowUp` + testes dos 4 estados e da virada de dia | Engenharia | Sprint 2 | NÃO INICIADO |
| 7 | Unificar geração de link `wa.me` em `src/lib/whatsapp.ts` (absorve as 4 duplicações) | Engenharia | Sprint 2 | NÃO INICIADO |
| 8 | Rota `/vendas/crm`, chave `comercial:crm` (Decisão **D**), card e modais | Engenharia | Sprint 3 | NÃO INICIADO |
| 8b | Filtro + badge "Estagnados >30 dias" (Decisão **E**), sem escrita automática | Engenharia | Sprint 3 | NÃO INICIADO |
| 9 | Piloto de 2 semanas com a recepção antes de liberar para todos | @Raniery | Sprint 4 | NÃO INICIADO |
| 10 | TDD de implementação, se a Opção 2 for aprovada | @Raniery | Após a decisão | NÃO INICIADO |

---

## Outcome

**Decisão:** **Opção 2 aprovada** — extrair o núcleo do Kanban de contatos para um componente compartilhado e montar o CRM de vendas sobre o fluxo de status existente. Decisões A–F respondidas conforme a tabela acima.

**Data da decisão:** 2026-09-18

**Decidido por:** @Dr. Felipe (Approver), com Driver @Raniery

**Racional:** O trade-off central era a semana extra de extração da Opção 2 contra o prazo da Opção 3. Pesou o critério **C5 (custo de manutenção)**: o projeto já carrega o precedente do avatar reimplementado em 8 telas ([RFC 006](006-foto-do-paciente-google-drive-e-avatar.md)), e deixar dois Kanbans seria repetir conscientemente o mesmo erro numa mecânica bem mais complexa que um avatar. A medição de produção reforçou a escolha por um caminho oblíquo: como o valor real da entrega é **passar a registrar a perda** (achado 7), e não o quadro em si, não havia urgência de prazo que justificasse comprar dívida — os R$ 238.650 represados estão parados há uma mediana de 37 dias, não há relógio correndo em dias.

**Fatores determinantes:**
- **C5** — um Kanban com dois consumidores, contra dois Kanbans divergentes desde o dia 1.
- **Achado 7** — 217 confirmadas contra 3 recusadas: o funil não registra perda. A coluna Perdido com objeção estruturada é a entrega de maior valor, e ela custa o mesmo nas Opções 1, 2 e 3.
- **C1** — reusar `atualizarStatusVenda` mantém as travas financeiras num único lugar já testado, sem caminho paralelo que possa divergir.
- **`/contatos` como teste de regressão vivo** — a extração quebra cedo e visível, antes do CRM existir, em vez de tarde e silenciosamente.

**Condições / ressalvas:**
- **Decisão D reafirmada em 18/09 com dado novo à vista.** Medição posterior à decisão mostrou que **100% dos 79 orçamentos pendentes foram criados por fisioterapeutas** (nenhum por recepção ou gestão) e que 2 deles já têm `comercial:vendas` concedido. O Approver foi informado e manteve a decisão: a centralização do follow-up na recepção e na gestão é intencional. Registrado no TDD como **risco 11** (quem origina não acompanha) e como principal candidato a motivar `comercial:crm_completo` na V2.
- A **Decisão D tira o fisioterapeuta da V1.** A terceira persona do PRD (§Usuários) e o requisito §5.2 de acompanhamento pelo fisio ficam **fora de escopo** — o fisio cria orçamento e pode ser responsável comercial, mas não abre o quadro. Se a clínica quiser devolver esse acesso depois, a chave `comercial:crm_completo` volta à mesa; nada no modelo impede.
- A **Ação 4 (extração) migra `/contatos` sem nenhuma mudança de comportamento.** Se ela exigir mudança visível naquela rota, é sinal de que o corte entre genérico e específico está errado — parar e reavaliar, não improvisar.
- A **taxa de conversão só vira métrica confiável depois** de a coluna Perdido ser usada. Até lá, exibi-la no painel de KPIs é exibir 98,6% — considerar ocultar o KPI ou marcá-lo como "em formação" na V1.
- Os **40 cards estagnados entram no quadro como estão**, sinalizados. Nenhuma escrita automática (Decisão E).

**Follow-up:**
- [x] Registrar as respostas das Decisões A–F neste documento
- [x] Criar TDD de implementação — [TDD 008](../tdds/008-crm-de-vendas-e-orcamentos-kanban-e-follow-up.md) (2026-09-18). **Corrige um ponto desta RFC:** a Decisão D não é implementável só com `requireModulo` — ver o aviso de abertura do TDD e sua §5.9
- [ ] Atualizar o PRD 008 onde a decisão divergiu dele: §6.1 (`status_follow_up` não será coluna), §6.2 (RLS explícita), §2.3 (objeção de perda em campo próprio), §1.2 (KPI de conversão), §5.2 e §Usuários (fisio fora da V1), §5.3 (lote fora da V1)
- [ ] Comunicar a recepção — é ela quem opera a régua na V1
- [ ] Retrospectiva de adoção 60 dias após o lançamento. Metas: % de cards pendentes com follow-up agendado; % de perdas com objeção estruturada; e a métrica que importa de verdade — **o número de `orcamento_recusado` deixar de ser 3**
