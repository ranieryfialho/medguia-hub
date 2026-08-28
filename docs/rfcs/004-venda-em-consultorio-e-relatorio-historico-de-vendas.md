# RFC: Atribuição Comercial (Consultório vs. Conversão Fisio) e Relatório de Vendas Históricas

| Campo | Valor |
|-------|-------|
| **Impacto** | **ALTO** — nova coluna em `vendas`, mudança no formulário usado pela recepção todo dia, nova rota de relatório e uma decisão de arquitetura de agregação que define se o "zero divergência" do PRD é alcançável. |
| **Status** | **READY FOR DECISION** |
| **Driver** | @Raniery |
| **Approver** | @Dr. Felipe (dono) |
| **Contributors** | Engenharia (MedGuia Hub), Gestão Comercial, Coordenação de Recepção |
| **Informed** | Recepção, fisioterapeutas |
| **Due Date** | TBD — sugerido decidir em até 1 semana |
| **Resources** | [PRD 004](../prds/004-venda-em-consultorio-e-relatorio-historico-de-vendas.md) · [RFC 003](003-auditoria-de-exclusao-de-agendamentos.md) · [RFC 002](002-ciclo-de-vida-dos-status-personalizados.md) |
| **Created** | 2026-08-27 |
| **Last Updated** | 2026-08-27 |

---

## Sumário Executivo

O PRD 004 pede três coisas: um **toggle** de "venda em consultório" no lançamento de vendas, a **segmentação** desse dado no relatório de vendas existente, e uma **nova rota de vendas históricas** com evolução mensal, MoM e drill-down.

O toggle é barato e direto. A parte histórica não é — e o levantamento de código muda o enquadramento em três pontos que não estão no PRD:

> **1. O relatório de vendas atual não agrega no banco. Ele baixa tudo e soma em JavaScript.** [`page.tsx:126-161`](../../src/app/(painel)/relatorios/vendas/page.tsx#L126-L161) faz **uma** query `select` com joins de paciente, profissional, itens e produtos, **sem `.range()` e sem `limit`**, e depois percorre o array num `for` de ~120 linhas ([L202-L320](../../src/app/(painel)/relatorios/vendas/page.tsx#L202-L320)). Hoje o filtro padrão é **um mês**, e por isso funciona. O PRD pede **36 meses** com meta de **1,5s**. Reaproveitar esse desenho significa trazer 36× o volume atual para a memória do servidor a cada page load.

> **2. O PostgREST corta a resposta silenciosamente.** Sem `.range()`, o `db-max-rows` do PostgREST (padrão 1000 na stack self-hosted deste projeto) trunca **sem erro**. Não existe hoje nenhuma checagem de `count` contra o tamanho do array retornado. O modo de falha não é "relatório lento" — é **relatório com número errado, sem aviso**. Isso ataca diretamente a métrica central do PRD ("zero discrepâncias") e é um risco que já existe hoje, latente, quando alguém filtra um período longo.

> **3. Uma "NUNCA PODE" do PRD já é violada pelo código atual.** O PRD proíbe *"deixar de computar vendas no ticket médio histórico por ausência de itens"*. Mas [`page.tsx:211`](../../src/app/(painel)/relatorios/vendas/page.tsx#L211) faz `if (itens.length === 0) continue` — uma venda sem itens é **descartada** da contagem e do faturamento. O denominador do ticket médio (`totalVendas`, [L323](../../src/app/(painel)/relatorios/vendas/page.tsx#L323)) já exclui esses casos. Qualquer relatório histórico novo que use uma regra diferente vai **divergir do relatório atual por construção** — e a divergência aparecerá como bug do relatório novo, quando a origem é o antigo.

Há ainda um detalhe factual: **o gráfico de "Evolução do Ticket Médio" que o PRD cita como referência da tela do dashboard não existe no código.** [`dashboard/page.tsx`](../../src/app/(painel)/dashboard/page.tsx) tem 405 linhas e **zero** ocorrências de `vendas`. O único "Ticket Médio" do projeto é um card estático em [`relatorios/vendas/page.tsx:492`](../../src/app/(painel)/relatorios/vendas/page.tsx#L492). Ou seja: a rota histórica não é a expansão de um gráfico existente — é construção do zero, e a estimativa precisa refletir isso.

**Recomendação: Opção 2 — agregação mensal no Postgres via função `SECURITY DEFINER`, com uma única definição canônica de "venda contável" compartilhada pelos dois relatórios.** O toggle entra como coluna simples com `CHECK` que o amarra à origem médica. A nova rota consome linhas já agregadas (36 linhas para 36 meses, não 36 meses de vendas), e o drill-down mensal é uma segunda chamada sob demanda.

---

## Background

### Situação atual

**Módulo de vendas.** A tabela `vendas` tem `origem` (texto livre validado na action) e `medico_referenciador_id` + `medico_referenciador_nome` desnormalizado. As migrations aditivas do módulo estão em `database/vendas_*_migration.sql` — o padrão do projeto é `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` com `DEFAULT`, aplicado pelo SQL Editor do Studio.

A regra "médico referenciador é obrigatório quando origem = medico" já existe, mas **só na Server Action**, duplicada em `criarVenda` ([vendas.ts:133](../../src/actions/vendas.ts#L133)) e `editarVenda` ([vendas.ts:282](../../src/actions/vendas.ts#L282)). Não há `CHECK` no banco. Esse é o precedente direto do que o PRD pede para o toggle — e é o precedente que **não** deve ser copiado, pela mesma razão do achado 1 do RFC 003: regra replicada em duas actions nasce dessincronizada na terceira.

**Relatório de vendas.** A rota `/relatorios/vendas` é um Server Component de 1.047 linhas que:

| Etapa | Onde | O que faz |
|-------|------|-----------|
| Query | [L126-146](../../src/app/(painel)/relatorios/vendas/page.tsx#L126-L146) | `select` com 4 joins aninhados, filtros aplicados no banco, **sem paginação** |
| Agregação | [L202-L320](../../src/app/(painel)/relatorios/vendas/page.tsx#L202-L320) | Um `for` que preenche 8 acumuladores (`porOrigem`, `porProfissional`, `porReferenciador`, `porProduto`, `porCategoria`, `porPeriodo`, …) |
| Filtro de status | [L242-L251](../../src/app/(painel)/relatorios/vendas/page.tsx#L242-L251) | Orçamentos pendentes/recusados são contados à parte e saem dos KPIs via `continue` — **isso já está correto** e atende a "NUNCA PODE" do PRD sobre orçamentos |
| PDF | [`pdf-vendas.ts`](../../src/lib/relatorios/pdf-vendas.ts) | Recebe os totais já calculados; ticket médio em [L117](../../src/lib/relatorios/pdf-vendas.ts#L117) |

O filtro por médico referenciador é feito por **nome** (`medico_referenciador_nome`, [L146](../../src/app/(painel)/relatorios/vendas/page.tsx#L146)), não por id — detalhe que importa para o filtro "por médico" do relatório histórico, porque nomes não são chave estável.

**Dashboard.** Sem nenhum dado de vendas. O gráfico citado pelo PRD não existe.

**Stack disponível:** `recharts` ^3.8.1, `jspdf` ^4.2.1 e `xlsx` ^0.18.5 já são dependências — os requisitos 3.2 (gráfico) e 3.5 (exportação PDF/XLSX) não exigem biblioteca nova.

### O problema

**1. Não há atribuição comercial.** Toda venda de origem "Médico" é uma linha só. Gestão não distingue o médico que fecha o tratamento no consultório do médico que apenas encaminha o contato — e o fisioterapeuta que converteu uma indicação difícil aparece igual ao que recebeu o paciente com o plano pronto. Comissão e avaliação de parceria são decididas hoje sem esse dado.

**2. Não há visão histórica.** A pergunta "como evoluiu nosso faturamento nos últimos 12 meses" hoje se responde rodando o relatório mês a mês, manualmente, e anotando os números fora do sistema.

**3. O relatório atual tem um teto silencioso.** Ver achado 2. Não é um problema visível hoje porque ninguém filtra períodos longos — o PRD é exatamente o que vai fazer alguém filtrar períodos longos.

### Por que agora

1. O toggle só produz dado **a partir do momento em que existe**. Cada semana sem ele é uma semana de vendas médicas que ficam permanentemente não classificadas — e o PRD colocou edição retroativa em lote **fora do escopo**, o que torna a lacuna definitiva na prática.
2. O relatório histórico e a segmentação do relatório atual dependem da **mesma** definição de "venda contável". Fazer os dois com a mesma regra custa uma vez; descobrir depois que divergem custa a confiança nos dois.
3. O teto do PostgREST vira defeito visível assim que a rota histórica existir.

### O que acontece se não decidirmos

A atribuição comercial continua anedótica, a apuração mensal continua manual em planilha fora do sistema, e o truncamento silencioso permanece latente esperando o primeiro filtro de período longo.

---

## Dados Relevantes

**Levantamento de código (27/08/2026)** — o que está verificado:

| Achado | Evidência | Verificado |
|--------|-----------|-----------|
| Agregação do relatório é 100% em memória | `for` em [page.tsx:202-320](../../src/app/(painel)/relatorios/vendas/page.tsx#L202-L320) | ✅ |
| Query sem `.range()` / `limit` | `grep` por `range(`/`limit(` no arquivo → zero ocorrências | ✅ |
| Venda sem itens é descartada | `if (itens.length === 0) continue` — [page.tsx:211](../../src/app/(painel)/relatorios/vendas/page.tsx#L211) | ✅ |
| Orçamentos já saem dos KPIs corretamente | [page.tsx:242-251](../../src/app/(painel)/relatorios/vendas/page.tsx#L242-L251) | ✅ |
| Dashboard não tem gráfico de ticket médio | 0 ocorrências de `vendas` em [dashboard/page.tsx](../../src/app/(painel)/dashboard/page.tsx) | ✅ |
| Regra de origem médica duplicada nas actions, sem `CHECK` no banco | [vendas.ts:133](../../src/actions/vendas.ts#L133) e [vendas.ts:282](../../src/actions/vendas.ts#L282) | ✅ |
| Filtro de médico é por nome, não por id | [page.tsx:146](../../src/app/(painel)/relatorios/vendas/page.tsx#L146) | ✅ |
| `recharts`, `jspdf` e `xlsx` já instalados | [package.json](../../package.json) | ✅ |

**Não medido — entra como consulta pré-decisão (Ação 1):** volume atual de linhas em `vendas` e `itens_venda`, e o `db-max-rows` efetivo do PostgREST na VPS. Não muda a recomendação (a Opção 2 é robusta em qualquer volume), mas define se o truncamento é um risco **presente** ou apenas futuro — e portanto se a Ação 5 é correção urgente ou parte da entrega normal.

---

## Suposições

| # | Suposição | Owner | Confiança | Gatilho de invalidação |
|---|-----------|-------|-----------|------------------------|
| 1 | "Venda em consultório" é atributo **da venda**, não do médico — o mesmo médico pode fechar no consultório numa venda e só encaminhar em outra | Gestão | **Alta** | Se for característica fixa do parceiro, o dado pertence a `profiles` e o toggle vira redundante |
| 2 | Vendas médicas legadas podem assumir `false` (= "conversão fisio") sem distorcer análise histórica | @Dr. Felipe | **Média** | Se a gestão for comparar períodos antes/depois do toggle, o `false` legado infla artificialmente a conversão do fisio. Mitigação na Opção 2: distinguir "não informado" de "não" |
| 3 | O drill-down mensal (3.3) é consultado sob demanda, para poucos meses por sessão — não para os 36 de uma vez | Gestão | **Média** | Se virar uso normal expandir tudo, o carregamento sob demanda precisa virar pré-agregação |
| 4 | `venda_confirmada` é a única definição de faturamento realizado, nos dois relatórios | Gestão | **Alta** | Já é o comportamento atual do relatório e está explícito nas "NUNCA PODE" do PRD |
| 5 | Não há necessidade de recalcular histórico retroativamente ao editar uma venda antiga | Engenharia | **Alta** | Verdadeiro para agregação sob demanda (Opção 2). **Falso** para materialização (Opção 3) — é o principal motivo de ela não ser recomendada agora |
| 6 | A meta de 1,5s é para o período padrão (12 meses), não para 36 meses com todos os drill-downs abertos | Gestão | **Média** | Se 36 meses tiver que caber em 1,5s com filtros combinados, revisar para a Opção 3 |

---

## Critérios de Decisão

Definidos **antes** das opções.

| # | Critério | Peso | Tipo |
|---|----------|------|------|
| C1 | **Consistência entre relatórios** — dashboard, `/relatorios/vendas` e `/relatorios/vendas-historicas` produzem o mesmo número para o mesmo intervalo | 5 | **Must-have** |
| C2 | **Ausência de truncamento silencioso** — nenhum caminho pode devolver número incompleto sem erro | 5 | **Must-have** |
| C3 | **Toggle restrito à origem médica**, garantido no servidor e não só na UI | 5 | **Must-have** |
| C4 | **Orçamentos fora do faturamento realizado** | 5 | **Must-have** |
| C5 | **Performance** — 12 meses bem dentro de 1,5s; 36 meses sem degradação inaceitável | 4 | Alto |
| C6 | **Ponto único de definição da regra** — "venda contável" definida uma vez, não replicada por relatório | 4 | Alto |
| C7 | **Cobertura funcional do PRD** — toggle, segmentação, cards, tabela MoM, drill-down, filtros, exportação | 4 | Alto |
| C8 | **Custo e risco de regressão** em código de produção usado diariamente | 3 | Médio |
| C9 | **Reversibilidade** | 2 | Baixo |

**Regra de decisão:** opção que falhe qualquer Must-have está descartada, independentemente de custo.

---

## Opções Consideradas

### Opção 0 — Não fazer nada

**Prós:** custo zero, nenhum risco de regressão.
**Contras:** nenhuma demanda do PRD atendida; a atribuição comercial permanece impossível de reconstruir retroativamente; o truncamento silencioso segue latente.
**Avaliação:** falha C1–C7. Linha de base apenas.

---

### Opção 1 — Implementação literal do PRD (estender o padrão atual)

Adicionar a coluna, o toggle nos dois formulários, e criar `/relatorios/vendas-historicas` **como cópia estrutural** de `/relatorios/vendas`: buscar as vendas do período e agregar por mês em JavaScript.

**Como funciona**
1. `ALTER TABLE vendas ADD COLUMN venda_em_consultorio boolean NOT NULL DEFAULT false`.
2. Toggle em `FormNovaVenda` / `FormEditarVenda`, condicionado a `origem === 'medico'`; validação nas duas actions, no mesmo formato da regra de médico obrigatório.
3. Nova rota faz o `select` do período completo e monta os buckets mensais num `for`.

**Prós**
- Menor esforço e padrão já conhecido do time — nenhum SQL além do `ALTER TABLE`.
- Reusa integralmente os componentes e o estilo do relatório existente.

**Contras**
- **Herda o truncamento silencioso, agravado.** 36 meses num único `select` sem `.range()` é o cenário exato em que o `db-max-rows` corta. Falha C2.
- **Duplica a definição de "venda contável"** — as regras de `status`, de itens e de datas passam a existir em dois arquivos grandes. A regra `itens.length === 0 → continue` do relatório atual precisa ser reproduzida com fidelidade no novo, incluindo o comportamento que o PRD proíbe. Falha C6 e, na prática, C1.
- **Regra do toggle replicada em duas actions**, sem garantia no banco — repete o padrão que já falhou em RFC 003. Falha C3.
- Custo de performance cresce linearmente com o histórico, sem teto.

**Custo:** ~5d.
**Avaliação:** **falha C1, C2, C3 e C6.**

---

### Opção 2 — Agregação no Postgres + definição canônica única ✅ **RECOMENDADA**

O cálculo migra para o banco. As páginas passam a consumir **linhas já agregadas**.

**a) Coluna com `CHECK` que amarra o toggle à origem**

```sql
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS venda_em_consultorio BOOLEAN;

ALTER TABLE public.vendas
  ADD CONSTRAINT vendas_consultorio_apenas_origem_medico
  CHECK (venda_em_consultorio IS NULL OR origem = 'medico');

CREATE INDEX IF NOT EXISTS idx_vendas_data_status
  ON public.vendas (data_venda, status);
```

**`BOOLEAN` nullable, não `NOT NULL DEFAULT false` como o PRD pede.** É a única divergência deliberada do PRD, e a razão é a Suposição 2: com `NOT NULL DEFAULT false`, toda venda médica anterior à entrega passa a afirmar *"o fisioterapeuta converteu"* — uma afirmação que ninguém fez. Três estados (`NULL` = não informado, `true` = consultório, `false` = conversão fisio) permitem que os cards mostrem "não classificadas" em vez de inflar a coluna do fisio no primeiro relatório histórico que a gestão abrir. O default de **UI** continua `false`, como o PRD pede — a escolha consciente do operador é preservada; o que muda é apenas que o legado não mente.

O `CHECK` atende C3 no banco: nenhuma action, script ou correção manual consegue marcar consultório fora da origem médica. As actions continuam validando (mensagem de erro amigável), mas deixam de ser a única linha de defesa.

**b) Uma função canônica de agregação mensal**

```
fn_vendas_resumo_mensal(
  p_data_inicio    DATE,
  p_data_fim       DATE,
  p_profissional_id UUID    DEFAULT NULL,
  p_medico_id      UUID     DEFAULT NULL,
  p_origem         TEXT     DEFAULT NULL,
  p_categoria      TEXT     DEFAULT NULL
) RETURNS TABLE (
  mes                    DATE,
  faturamento            NUMERIC,
  qtd_vendas             INT,
  ticket_medio           NUMERIC,
  faturamento_consultorio NUMERIC,
  qtd_consultorio        INT,
  faturamento_fisio      NUMERIC,
  qtd_fisio              INT,
  qtd_nao_classificada   INT,
  top_produto            TEXT,
  top_profissional       TEXT
)
```

Uma linha por mês. Para 36 meses são **36 linhas**, independentemente de haver 300 ou 30.000 vendas no período. C2 e C5 deixam de depender do volume.

Dentro dela, uma CTE define **"venda contável"** — `status = 'venda_confirmada'`, faturamento somado de `itens_venda`, tratamento explícito de venda sem itens. Essa CTE é a definição canônica, e é o que dá C1 e C6: os dois relatórios passam a ler a mesma regra do mesmo lugar.

**c) `/relatorios/vendas` passa a usar a mesma fonte**

Este é o item que o PRD não pede e que a recomendação inclui deliberadamente. "Zero divergência" (C1) não é verificável enquanto os dois relatórios calcularem por caminhos diferentes; é uma propriedade que só existe se houver **uma** fonte. A rota atual mantém seus KPIs de topo (faturamento, volume, ticket médio) vindos da função, e mantém em memória apenas as listagens detalhadas — que são naturalmente paginadas.

**Aqui está a decisão que precisa ser tomada explicitamente**, porque muda um número em produção: a CTE vai contar venda confirmada sem itens como **venda de R$ 0,00** (entra no denominador do ticket médio) ou vai continuar descartando-a? O PRD manda contar; o código hoje descarta. Contar é o comportamento correto e é o que a recomendação assume — mas o ticket médio do relatório atual **vai mudar** no dia da entrega, e a gestão precisa saber disso antes, não depois. É a Questão em Aberto 1.

**d) Rota `/relatorios/vendas-historicas`**

- **Cards executivos (3.1)** e **tabela mês a mês (3.3)**: derivados das 36 linhas, com MoM calculado sobre linhas adjacentes. Mês sem venda aparece com faturamento zero e MoM `—` (divisão por zero não é `-100%`).
- **Gráfico (3.2)**: `recharts`, já instalado. Alternância de métrica é troca de série sobre o mesmo dataset — nenhuma ida ao servidor.
- **Drill-down (3.3)**: segunda função, `fn_vendas_detalhe_mes(p_mes, …)`, chamada **ao expandir a linha**. Sustentado pela Suposição 3.
- **Filtros (3.4)**: parâmetros da função. O filtro por médico passa a ser por **`medico_referenciador_id`**, não por nome — o filtro atual por nome ([page.tsx:146](../../src/app/(painel)/relatorios/vendas/page.tsx#L146)) quebra em homônimos e em qualquer correção de cadastro.
- **Exportação (3.5)**: `jspdf` e `xlsx` já instalados, sobre os dados já em tela.
- **Menu e link**: entrada em [`Sidebar.tsx`](../../src/components/layout/Sidebar.tsx#L308), ao lado de `/relatorios/vendas`, no grupo Comercial já existente.

O card do dashboard citado pelo PRD **não existe** — está fora desta entrega e registrado na Questão em Aberto 4.

**e) Segmentação no relatório atual (requisito 2)**

Filtro de modalidade, cards comparativos, colunas nas tabelas de médico e de profissional, tag na listagem detalhada e bloco no [`pdf-vendas.ts`](../../src/lib/relatorios/pdf-vendas.ts). Com a coluna e a função prontas, é trabalho de apresentação.

**Prós**
- Único desenho em que C1 e C2 são propriedades do sistema, não disciplina de quem escreve a página.
- O custo de consulta deixa de crescer com o histórico.
- `CHECK` no banco fecha C3 de forma não contornável.
- Corrige, de passagem, o truncamento latente do relatório atual.
- Distingue "não classificado" de "conversão fisio" — o histórico não nasce mentindo.

**Contras**
- Lógica de negócio em SQL: mais difícil de testar com o `node --test` do projeto e exige aplicação da migration pelo SQL Editor do Studio, como nas entregas anteriores.
- **Mexe em código de produção que roda todo dia** (item c). É o maior risco desta opção, e a razão de o item c ir com validação lado a lado antes do corte (Ação 8).
- Muda um número existente em produção (ticket médio), exigindo comunicação prévia.
- Divergência deliberada do PRD no `NOT NULL DEFAULT false`.

**Custo:** ~9d (ver Custo Estimado).
**Avaliação:** atende C1–C7 e C9. Custo médio-alto (C8).

---

### Opção 3 — Tabela materializada de resumo mensal

Manter `vendas_resumo_mensal` atualizada por trigger em `vendas`/`itens_venda`, ou por job noturno.

**Prós**
- Leitura trivialmente rápida — melhor C5 de todas as opções.
- Boa base se o volume crescer uma ordem de magnitude.

**Contras**
- **Invalida a Suposição 5.** Toda edição ou exclusão de venda antiga precisa recalcular o mês afetado. Trigger em `itens_venda` significa recalcular no meio do fluxo de cadastro, e uma falha ali quebra o cadastro de venda — não só o relatório.
- **Cria uma segunda fonte de verdade**, que é exatamente o que C1 proíbe. Materialização dessincronizada é a causa mais comum de divergência entre relatórios — o problema que este RFC existe para evitar.
- Filtros combinados (profissional × médico × categoria) não são materializáveis sem explosão combinatória; na prática exigiria a função da Opção 2 **também**, para os casos filtrados.
- Não há evidência de que a Opção 2 seja lenta demais — a Ação 1 ainda não mediu o volume.

**Custo:** ~13d.
**Avaliação:** **falha C1** como desenho isolado. É a evolução natural da Opção 2 *se e quando* a medição mostrar necessidade — e barata de adicionar depois, porque a função canônica já define o que materializar.

---

## Comparativo

| Critério | Peso | Op. 0 | Op. 1 | **Op. 2** | Op. 3 |
|----------|:----:|:-----:|:-----:|:---------:|:-----:|
| C1 Consistência entre relatórios | 5 | ❌ | ❌ regra duplicada | ✅ fonte única | ❌ 2ª fonte de verdade |
| C2 Sem truncamento silencioso | 5 | ❌ latente | ❌ agravado | ✅ 36 linhas | ✅ |
| C3 Toggle restrito à origem médica | 5 | ❌ | ⚠️ só na action | ✅ `CHECK` no banco | ✅ |
| C4 Orçamentos fora do faturamento | 5 | ✅ | ✅ | ✅ | ✅ |
| C5 Performance | 4 | — | ❌ cresce sem teto | ✅ constante | ✅ melhor |
| C6 Ponto único de definição | 4 | ❌ | ❌ 2 arquivos | ✅ CTE canônica | ⚠️ |
| C7 Cobertura do PRD | 4 | ❌ | ✅ | ✅ | ✅ |
| C8 Custo / risco de regressão | 3 | ✅ 0d | ✅ ~5d | ⚠️ ~9d | ❌ ~13d |
| C9 Reversibilidade | 2 | — | ✅ | ✅ | ⚠️ |

Opções 0, 1 e 3 falham pelo menos um Must-have. O custo extra da Opção 2 sobre a Opção 1 (~4d) compra precisamente as duas propriedades que o PRD lista como métrica central ("zero discrepâncias") e como meta de performance.

---

## Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|:----------:|-----------|
| **Ticket médio do relatório atual muda** ao corrigir o descarte de vendas sem itens | **Alta** | Questão em Aberto 1. Medir antes quantas vendas confirmadas sem itens existem (Ação 2) e comunicar à gestão **antes** do deploy. Se o impacto for material, entregar com nota de rodapé explicando a mudança |
| **Refatorar `/relatorios/vendas`** quebra relatório usado diariamente | **Alta** | Validação lado a lado: rodar função e cálculo atual sobre os mesmos filtros e comparar totais antes do corte (Ação 8). Manter o caminho antigo até a comparação fechar |
| **`SECURITY DEFINER` com `search_path` mutável** — vetor clássico de escalação | **Alta** | `SET search_path = public, pg_temp` na definição. Revisão explícita no PR, como em RFC 003 |
| **Vendas legadas com `NULL`** confundem a leitura dos cards | Média | Suposição 2. Card explícito de "não classificadas" em vez de somar ao fisio. Some naturalmente com o tempo |
| **Drill-down de muitos meses abertos** derruba a percepção de performance | Média | Suposição 3. Carregamento sob demanda por mês; se virar padrão de uso, reavaliar (Ação 12) |
| **Filtro de médico muda de nome para id** — URLs salvas pela gestão param de funcionar | Baixa | Aceitar `medico_nome` como fallback por um ciclo, resolvendo para id |
| **`CHECK` falha na aplicação** se já existir linha inconsistente | Baixa | Impossível hoje: a coluna é nova e nasce `NULL`. Verificar mesmo assim no roteiro |
| **Alerta do build que derruba a VPS** (histórico do projeto) | Média | Build fora do horário de pico, como nas entregas anteriores |

---

## Custo Estimado

| Frente | Esforço | Observação |
|--------|:-------:|------------|
| Migration: coluna `venda_em_consultorio` + `CHECK` + índices | 0,5d | Aditiva |
| Toggle em `FormNovaVenda` e `FormEditarVenda` + validação nas 2 actions | 1d | Inclui limpar o valor ao trocar de origem |
| `fn_vendas_resumo_mensal` — CTE canônica, filtros, MoM, tops | 2d | Núcleo da entrega. Inclui `search_path` e testes |
| `fn_vendas_detalhe_mes` para o drill-down | 1d | |
| Rota `/relatorios/vendas-historicas`: cards, gráfico, tabela, filtros | 2d | `recharts` já instalado |
| Exportação PDF + XLSX | 0,5d | `jspdf` e `xlsx` já instalados |
| Segmentação consultório/fisio no `/relatorios/vendas` + PDF | 1d | Cards, colunas, tag, bloco no `pdf-vendas.ts` |
| Migrar KPIs de `/relatorios/vendas` para a função + validação lado a lado | 1d | Item de maior risco |
| Link no Sidebar + roteiro de aplicação + validação em produção | 0,5d | |
| **Total** | **~9,5d** | |

---

## Action Items

### Antes da decisão

| # | Ação | Owner | Resultado |
|---|------|-------|-----------|
| 1 | Medir volume de `vendas`/`itens_venda` e o `db-max-rows` efetivo do PostgREST na VPS | Engenharia | Define se o truncamento é risco presente ou futuro. Não bloqueia |
| 2 | Contar vendas confirmadas **sem itens** hoje | Engenharia | **Bloqueia** a Questão 1 — dimensiona a mudança no ticket médio |
| 3 | Confirmar com a gestão que "consultório" é atributo da venda e não do médico (Suposição 1) | Gestão | **Bloqueia** o desenho da coluna |
| 4 | Decidir o tratamento das vendas médicas legadas: `NULL` ou `false` (Suposição 2) | @Dr. Felipe | **Bloqueia** a migration |

### Decisão

| # | Ação | Owner |
|---|------|-------|
| 5 | Aprovar este RFC (Opção 2) e responder as Questões em Aberto | @Dr. Felipe |

### Execução

| # | Ação | Owner | Bloqueia |
|---|------|-------|----------|
| 6 | Migration: coluna, `CHECK`, índices | Engenharia | 7, 9 |
| 7 | Toggle nos dois formulários + validação nas actions | Engenharia | — |
| 8 | `fn_vendas_resumo_mensal` + validação lado a lado contra o cálculo atual | Engenharia | 9, 10, 11 |
| 9 | Segmentação consultório/fisio em `/relatorios/vendas` + PDF | Engenharia | — |
| 10 | Rota `/relatorios/vendas-historicas` + drill-down + exportação | Engenharia | 11 |
| 11 | Migrar KPIs do relatório atual para a função + Sidebar + validação em produção | Engenharia | — |

### Depois do go-live

| # | Ação | Owner | Prazo |
|---|------|-------|-------|
| 12 | Medir tempo real de 36 meses e o padrão de uso do drill-down (Suposições 3 e 6) — decide se a Opção 3 entra | Engenharia | +30 dias |
| 13 | Verificar taxa de preenchimento do toggle — meta de 100% das vendas médicas classificadas | Gestão | +30 dias |
| 14 | Reavaliar edição retroativa em lote (fora do escopo da V1) à luz do volume de `NULL` restante | Gestão | +90 dias |

---

## Questões em Aberto

1. **Venda confirmada sem itens conta como venda de R$ 0,00 no ticket médio?** O PRD diz que sim ("NUNCA PODE deixar de computar por ausência de itens"); o código hoje diz que não ([page.tsx:211](../../src/app/(painel)/relatorios/vendas/page.tsx#L211)). Seguir o PRD **muda um número que a gestão já vê hoje**. Recomendação: seguir o PRD, com a Ação 2 dimensionando o impacto antes do deploy.
2. **Vendas médicas legadas ficam `NULL` ou `false`?** O PRD pede `NOT NULL DEFAULT false`; a recomendação é `NULL` para não afirmar retroativamente que o fisio converteu. Se a gestão preferir simplicidade a precisão histórica, `false` é aceitável — mas a decisão deve ser consciente, porque é irreversível na prática sem edição em lote (que está fora do escopo).
3. **A refatoração dos KPIs de `/relatorios/vendas` (item c) entra nesta entrega ou vira RFC próprio?** Ela é o que torna "zero divergência" verificável, mas é também o maior risco de regressão. Adiá-la entrega o relatório histórico mais rápido, ao custo de duas fontes de cálculo convivendo — exatamente o que a métrica do PRD proíbe. Recomendação: manter na entrega, com a validação lado a lado da Ação 8.
4. **O card/gráfico de vendas no dashboard entra no escopo?** O PRD o trata como existente; ele não existe. Fora do escopo por padrão; +0,5d se entrar, agora barato porque a função já devolve a série mensal pronta.
5. **A "Taxa de Conversão da Equipe" (2.2) usa qual denominador?** Indicações médicas convertidas ÷ total de encaminhamentos médicos — mas encaminhamento que virou orçamento recusado conta no denominador? Recomendação: sim, senão a taxa é sempre 100%.

---

## Outcome

*(a preencher após a decisão)*

- **Decisão:**
- **Data:**
- **Decidido por:**
- **Justificativa:**
- **Divergências registradas:**
