# RFC: Ciclo de Vida dos Status Personalizados — Observação, Visibilidade na Agenda e Fallback

| Campo | Valor |
|-------|-------|
| **Impacto** | **MÉDIO** — afeta todos os profissionais que usam status personalizados, o relatório de Tempo Fábril e a visão gerencial da agenda. Mexe em trigger, `pg_cron` e na função de resolução de status em produção. Sem RLS nova. |
| **Status** | **READY FOR DECISION** — todas as consultas pré-decisão concluídas em 10/08 |
| **Driver** | @Raniery |
| **Approver** | @Dr. Felipe (dono — pediu o fallback de 1h) |
| **Contributors** | Engenharia (MedGuia Hub), Gestão de equipe |
| **Informed** | Fisioterapeutas, médicos e demais profissionais com status personalizado |
| **Due Date** | TBD — sugerido decidir em até 1 semana |
| **Resources** | [PRD 002](../prds/002-ajuste-nos-status-personalizados-dos-fisios.md) · [RFC 001](001-ponto-eletronico-clt.md) |
| **Created** | 2026-08-10 |
| **Last Updated** | 2026-08-10 |

---

## Sumário Executivo

O PRD 002 pede três coisas: **campo de observação** nos status personalizados, **card na rota de agendamento** mostrando o status do profissional, e **fallback de 2h → 1h**.

Ao levantar o código para dimensionar o terceiro item, encontramos um defeito que muda o enquadramento do RFC:

> **O fallback atual não devolve o profissional ao estado normal.** O job `fechar-status-esquecidos` só fecha o registro em `historico_status_disponibilidade` (`fim = inicio + 2h`). Ele **não toca** em `status_disponibilidade.status`. Como a `fn_status_equipe_agora` preserva qualquer status manual indefinidamente, o profissional continua aparecendo "Em reunião" no widget — e passaria a aparecer assim no card novo — **para sempre**, até alguém trocar manualmente.

Ou seja: hoje o relatório e a tela contam histórias diferentes depois de 2h. Trocar 2h por 1h sem corrigir isso apenas faz a divergência começar mais cedo. E como o item 2 do PRD (card na agenda) **expõe justamente o estado ao vivo**, entregá-lo sobre a base atual amplia o problema em vez de resolvê-lo.

Um segundo achado, ao formalizar o que cada status significa (seção **Contrato dos Status**): `ocupado` está classificado no catálogo como status *personalizado* (`sistema = false`), quando é derivado da agenda. Por isso ele aparece na lista "Meu status" do widget — e quem o escolhe **encerra sua reunião em curso e passa a aparecer como "Disponível"**. Além disso, atendimento em curso mascara o status declarado, e a interseção entre os dois é contada **duas vezes** no Tempo Fábril — medida em **0,77%** de inflação em 90 dias, abaixo do limiar de materialidade, e por isso fora do escopo desta entrega.

**As medições em produção (10/08) confirmaram o diagnóstico**: 3 profissionais travados no momento da consulta, um deles há 2 dias e 20 horas. Ver Dados Relevantes.

**Recomendação: Opção 2 — tratar o status personalizado como um ciclo de vida com início, contexto e fim garantido, sobre um contrato explícito de status operacionais.** Observação obrigatória por status (configurável pelo gestor), fallback de 1h que fecha o histórico *e* devolve o profissional para "Disponível", card na agenda com status + observação + tempo decorrido, e correção do contrato dos operacionais (`disponivel` / `ocupado` / `ausente`).

---

## Background

### Situação atual

O sistema de status já existe e está em produção, montado em quatro peças:

| Peça | Onde | O que faz |
|------|------|-----------|
| Catálogo de status | [`status_disponibilidade_opcoes`](../../database/status_disponibilidade_opcoes_migration.sql) | Gestor cria/edita/ordena status (`reuniao`, `ocupado`, custom). `sistema = true` protege `disponivel` e `ausente`. |
| Estado atual | `status_disponibilidade` | Uma linha por profissional: `status`, `atualizado_em`, `origem`. Escrito por [`setStatusDisponibilidade`](../../src/actions/status-disponibilidade.ts#L13). |
| Histórico | [`historico_status_disponibilidade`](../../database/historico_status_disponibilidade_migration.sql) | Trigger `AFTER UPDATE OF status` abre/fecha intervalos. `duracao_minutos` é coluna gerada. Alimenta o Tempo Fábril. |
| Resolução ao vivo | [`fn_status_equipe_agora`](../../database/status_disponibilidade_opcoes_migration.sql#L70) | Combina atendimento em curso, status manual, jornada mensal e jornada semanal para dizer o status **agora**. |

O status manual é consumido hoje por [`WidgetDisponibilidade`](../../src/components/features/configuracoes/WidgetDisponibilidade.tsx) (FAB global) e [`StatusEquipeRealtime`](../../src/components/features/equipe/StatusEquipeRealtime.tsx) (em Configurações → Disponibilidade). **A rota de agendamento não mostra nada disso** — daí o item 2 do PRD.

O tempo em status personalizado entra no Tempo Fábril por [`kpis-tempo-fabril.ts`](../../src/lib/relatorios/kpis-tempo-fabril.ts#L313-L332), já capado pela interseção com a jornada real do profissional.

### O problema

**1. O status não diz o que aconteceu.** `historico_status_disponibilidade` guarda `status = 'reuniao'` e nada mais. O gestor vê 3h de "Em reunião" no Tempo Fábril e não tem como saber *qual* reunião, *com quem*, ou se aquilo era mesmo trabalho. O status é uma etiqueta sem lastro — exatamente a queixa que abre o PRD.

**2. O estado ao vivo não é visível onde a gestão opera.** Quem coordena a agenda não tem, na rota de agendamento, a informação de que o fisioterapeuta está em hora administrativa. Precisa navegar até Configurações → Disponibilidade.

**3. O fallback está pela metade.** Documentado abaixo em detalhe, porque é o achado que justifica este RFC.

### O defeito do fallback, em detalhe

O job atual, em [`ajustar_frequencia_cron_fallback.sql`](../../database/ajustar_frequencia_cron_fallback.sql):

```sql
UPDATE historico_status_disponibilidade
SET fim = inicio + INTERVAL '2 hours'
WHERE fim IS NULL AND inicio < NOW() - INTERVAL '2 hours';
```

Ele age sobre **uma** tabela. A `fn_status_equipe_agora`, porém, lê **outra**:

```sql
-- 2. Status manual (reuniao ou qualquer status customizado pelo gestor)
WHEN sd.status IS NOT NULL AND sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
  THEN sd.status
```

Consequências concretas, hoje, com o cap de 2h:

| Momento | `historico` | `status_disponibilidade` | O que a tela mostra | O que o relatório conta |
|---------|-------------|--------------------------|---------------------|-------------------------|
| 09:00 — entra em Reunião | registro aberto | `reuniao` | Em reunião · 0min | — |
| 10:30 | aberto | `reuniao` | Em reunião · 1h30 | — |
| 11:00 — cron fecha | `fim = 11:00`, 120min | `reuniao` | **Em reunião · 2h** | 2h |
| 17:00 — fim do expediente | fechado | `reuniao` | **Em reunião · 8h** | 2h |
| Dia seguinte, 08:00 | fechado | `reuniao` | **Em reunião · 23h** | 2h |

A linha "dia seguinte" é o ponto: o profissional aparece indisponível para a equipe inteira, indefinidamente, sem nenhum registro sendo gerado. Quem olha o widget conclui que ele está em reunião há 23h. **Esse é o estado que o card novo da agenda vai passar a exibir com destaque.**

Vale registrar que essa família de bug já mordeu antes: em 23/07/2026 um trigger legado duplicado inflava "Em reunião" no Tempo Fábril ([`fix_reuniao_duplicidade_migration.sql`](../../database/fix_reuniao_duplicidade_migration.sql)). A causa-raiz comum é a mesma — **mais de uma fonte da verdade sobre o mesmo fato, sem reconciliação**.

### Por que agora

1. O item 2 do PRD (card na agenda) **torna o defeito visível para toda a gestão**. Entregar o card sem corrigir o fallback é publicar o bug.
2. As três mudanças tocam as mesmas quatro peças (trigger, cron, `fn_status_equipe_agora`, componentes de status). Fazer em três PRs separados triplica o risco de regressão numa área que já teve incidente.
3. O Tempo Fábril é usado para decisão de gestão hoje. Cada semana com observação faltando é uma semana de dado que não dá para auditar retroativamente.

### O que acontece se não decidirmos

O status personalizado continua sendo uma etiqueta sem contexto; o Tempo Fábril continua produzindo números que ninguém consegue justificar linha a linha; e o estado "travado em reunião" segue acontecendo em silêncio.

---

## Dados Relevantes

Medições em produção em **2026-08-10 15:10 UTC**, via [`diagnostico_status_personalizados.sql`](../../database/diagnostico_status_personalizados.sql). Substituem as estimativas das Ações 1–3.

### O `pg_cron` está vivo — Suposição 3 confirmada

| Métrica | Valor |
|---------|-------|
| Extensão instalada | ✅ sim |
| Job `fechar-status-esquecidos` | ativo, `*/10 * * * *`, cap de 2h |
| Execuções registradas | 2.576 (2.574 sucessos, 2 falhas) |
| Última execução | 5 segundos antes da consulta |

**O plano B (rota de API + crontab do SO) está descartado.** O fallback funciona mecanicamente — o problema é que ele faz *metade* do trabalho.

### O defeito central, flagrado em produção

| Profissional | Status | Travado há | Histórico aberto? |
|--------------|--------|-----------|-------------------|
| Jéssica Teixeira | Hora administrativa | **2 dias 20h** | ❌ já fechado |
| Rafael Alencar | Em reunião | 2h56 | ❌ já fechado |
| Victor Emanuel | Em reunião | 2h56 | ❌ já fechado |

Os três com o histórico **já fechado** e o status ao vivo **ainda travado** — exatamente o cenário da tabela hora-a-hora do Background, que era hipotético quando foi escrito.

A corroboração é direta: a execução `runid 2603`, às **14:20 UTC**, retornou `UPDATE 2` — o cron fechando os registros de Rafael e Victor (iniciados 12:13 e 12:14, +2h). **Cinquenta minutos depois, os dois ainda apareciam "Em reunião" para a equipe inteira.** O intervalo entre o relatório parar de contar e a tela continuar mentindo é observável e está medido.

### Contagem dupla: 0,77% — abaixo do limiar

| Métrica (90 dias) | Valor |
|-------------------|-------|
| Minutos de atendimentos fabris | 121.140 |
| Minutos de status personalizados | 4.226 |
| **Sobreposição contada 2×** | **960 min (16h) em 26 pares** |
| **Inflação estimada** | **0,77%** |

Concentração: Jéssica 5,5h · João Vitor 3,7h · Luana 2,4h · Myla 1,9h · Rafael 1,5h · Bruno 1,0h.

**A causa-raiz não é sobreposição legítima — é status esquecido.** Quase todos os 26 pares têm `fim = inicio + 2h exatas`, ou seja, são blocos **capados pelo fallback**: o profissional marcou "Reunião", esqueceu, voltou a atender pacientes, e o cron fechou em 2h. A sobreposição é o rastro do esquecimento.

**Consequência para o escopo:** o teto de 1h ataca a causa-raiz diretamente. Cortando a janela de 2h para 1h, a sobreposição cai por construção — provavelmente para a faixa de 0,3%. Pelo limiar definido *antes* de ver o dado (`< 1% → ruído, corrigir por higiene, sem urgência`), a **dedup sai do escopo desta entrega** e vira item de backlog, a remedir depois que o fallback de 1h estiver em produção. Isso devolve **1,5d** ao orçamento (~8d → ~6,5d).

### Catálogo: Divergência 1 confirmada

`ocupado` está com `sistema = false`, ao lado de `reuniao`, `hora_administrativa` e `gravacao` — todos status declarados. E **2 profissionais estão com `status = 'ocupado'` gravado na tabela agora**, o que exige a investigação da seção seguinte.

### Escritores legados — verificado, parcialmente confirmado

[`status_disponibilidade_automatico.sql`](../../database/status_disponibilidade_automatico.sql) (migração antiga) criou dois escritores adicionais de `status_disponibilidade`. Verificação em 10/08:

| Escritor | Estado | Veredito |
|----------|--------|----------|
| Cron `atualizar-status-em-atendimento` (a cada minuto, grava `'ocupado'`) | ❌ **não agendado** — `cron.job` tem só um job; zero execuções registradas | Sem risco. Foi desagendado em algum momento |
| Trigger `trg_concluir_atendimento` (grava `'disponivel'` ao concluir atendimento sem próximo em 90 min) | ✅ **ATIVO** (`tgenabled = 'O'`), função viva | **Confirmado — remover** |
| Função órfã `fn_atualizar_status_em_atendimento` | existe, sem chamador | Limpeza |
| `fn_trigger_historico_reuniao` (o culpado de julho) | ❌ não existe | ✅ o fix de julho pegou |

**A avaliação inicial deste RFC superestimou o risco.** Não há escritor de minuto; não há dano material observável. A busca por blocos anormalmente curtos (< 5 min em 90 dias) devolveu **7 registros, todos explicáveis como cliques de usuário** — o par de Luana Arruda em 22/07 fecha `reuniao` e abre `hora_administrativa` no mesmo timestamp (`16:40:32.924286`), assinatura do trigger de log numa troca manual, não de interferência externa.

**Ainda assim o `trg_concluir_atendimento` deve sair**, por um argumento mais preciso que "é legado":

- Se `sd.status` já é `'disponivel'`, escrever `'disponivel'` é no-op.
- Se é status operacional, a `fn_status_equipe_agora` recalcula pela jornada de qualquer forma e ignora o valor gravado.
- **O único caso em que o trigger tem efeito observável é quando há status personalizado ativo — e aí ele o encerra em silêncio.**

Ou seja: sua única função efetiva hoje é destruir exatamente o dado que este RFC quer proteger. E sob a Opção 2 ele fica mais nocivo, porque o desenho passa a garantir que o status é declaração do profissional com vida de 1h — um escritor invisível quebra esse contrato.

Dispara pouco (durante o dia os atendimentos são seguidos e a condição dos 90 min bloqueia), o que explica a ausência de dano acumulado. Custo de remoção: **~0,5d**, não o ~1d reservado.

### `ocupado` manual: Divergência 1 flagrada ao vivo

Os 2 profissionais em `'ocupado'`, **ambos sem atendimento em curso**:

| Profissional | `atualizado_em` | Leitura |
|--------------|-----------------|---------|
| João Victor Barreto | 10/08, 10:14 | Com o cron morto, só resta uma explicação: **escolheu "Ocupado" no widget**. É o efeito 1 da Divergência 1, acontecendo hoje |
| Roberta Aguiar Arruda | **29/05** | Travada há 2,5 meses — resíduo da época em que o cron de minuto ainda rodava. Entra no backfill |

Nenhum dos dois aparece quebrado na tela (a `fn_status_equipe_agora` ignora `'ocupado'` e recalcula pela jornada), mas ambos são prova de que o catálogo e o comportamento estão dessincronizados.

---

## Contrato dos Status: Operacionais vs. Personalizados

Esta seção existe porque o sistema nunca declarou, em lugar nenhum, **o que cada status significa e quem tem autoridade para defini-lo**. A regra vive implícita dentro do `CASE` da `fn_status_equipe_agora` e diverge do catálogo (`status_disponibilidade_opcoes`) em pontos concretos. Sem esse contrato escrito, o item 1 do PRD ("início, meio e fim") não tem como ser verificado.

### As duas famílias

| Família | Quem define | Registrado em histórico? | Exemplos |
|---------|-------------|--------------------------|----------|
| **Operacional** (derivado) | O sistema, a partir de agenda e jornada. O profissional nunca escolhe. | Não | `disponivel`, `ocupado`, `ausente` |
| **Personalizado** (declarado) | O profissional, explicitamente. | **Sim** — abre e fecha registro, entra no Tempo Fábril | `reuniao`, hora administrativa, e o que o gestor criar |

**Regra que separa as duas:** um status personalizado é uma **afirmação do profissional sobre o próprio tempo** e por isso precisa de início, contexto e fim. Um status operacional é uma **leitura do sistema sobre a situação** e não precisa — ele é recalculado a cada consulta.

### Semântica dos operacionais

| Slug | Label | Significa | Origem |
|------|-------|-----------|--------|
| `disponivel` | Disponível (*livre*) | Está em horário de trabalho, sem atendimento em curso e sem status declarado | Jornada mensal (`jornada_mensal_profissional`) ou semanal (`disponibilidade_profissional`) |
| `ocupado` | **Em atendimento** *(renomear — ver abaixo)* | Há atendimento em curso agora (`Aguardando`, `Aguardando Consulta` ou `Confirmado`, dentro da janela `data_agendamento + duracao_minutos`) | Tabela `atendimentos` |
| `ausente` | Ausente | Fora do horário de trabalho, ou sem jornada cadastrada | Ausência de jornada aplicável ao momento |

### Cadeia de precedência

"Disponível aparece sempre que não há status vinculado" e "Ausente aparece fora do horário" são regras que se sobrepõem — a resolução real é uma **cadeia ordenada**, e é assim que precisa ser documentada:

```
1. Atendimento em curso agora?            → ocupado
2. Status personalizado declarado?        → esse status
3. Dentro da jornada (mensal > semanal)?  → disponivel
4. Caso contrário                         → ausente
```

**A ordem entre 1 e 2 é uma decisão em aberto deste RFC** — ver "Questão de precedência" abaixo. Os níveis 3 e 4 juntos são a formulação precisa de "Disponível quando não há status vinculado": *disponível* só vale **dentro** da jornada; fora dela, a ausência de status resolve para *ausente*, não para *disponível*.

### Divergência 1 — `ocupado` está classificado como personalizado

No seed ([`status_disponibilidade_opcoes_migration.sql`](../../database/status_disponibilidade_opcoes_migration.sql#L57-L62)) e no [`DEFAULT_OPCOES`](../../src/lib/status-disponibilidade-cores.ts#L44-L49), `ocupado` está com `sistema = false` — o mesmo flag de "Em reunião". Isso é um erro de classificação com três efeitos concretos **em produção hoje**:

1. **Aparece como escolha do profissional.** O widget monta a lista "Meu status" com `filter(o => !o.sistema || o.slug === 'disponivel')` ([`WidgetDisponibilidade.tsx`](../../src/components/features/configuracoes/WidgetDisponibilidade.tsx#L58-L60)) — então "Ocupado" está lá, ao lado de "Em reunião".
2. **Escolher "Ocupado" produz o oposto do esperado.** O trigger o trata como automático (`v_auto`), então **fecha o registro personalizado aberto e não abre nenhum**; a `fn_status_equipe_agora` também o exclui da regra 2 e cai na jornada. Resultado: quem clica em "Ocupado" **encerra sua reunião em curso e passa a aparecer como "Disponível"**.
3. **O gestor pode excluí-lo ou renomeá-lo.** `removerStatusOpcao` e `editarStatusOpcao` só bloqueiam `sistema = true` ([`status-disponibilidade-config.ts`](../../src/actions/status-disponibilidade-config.ts#L80)). Se o gestor excluir "Ocupado", a função SQL continua devolvendo o slug `'ocupado'` e a tela perde o label, exibindo o slug cru (`cfgPorSlug[p.status] ?? { label: p.status }`).

**Correção:** `UPDATE status_disponibilidade_opcoes SET sistema = true WHERE slug = 'ocupado'`, e o mesmo em `DEFAULT_OPCOES`. Isso simultaneamente o tira da lista "Meu status", protege contra edição/exclusão e alinha catálogo com comportamento. É um one-liner que fecha três buracos.

### Divergência 2 — renomear "Ocupado"

O label atual não comunica a origem. **"Em atendimento"** é preciso: diz que veio da agenda, e distingue de "ocupado" no sentido genérico de indisponível.

**Restrição:** trocar apenas `label` e `label_curto`. **O slug `'ocupado'` não pode mudar** — ele está hardcoded em quatro lugares que não têm integridade referencial entre si:

| Onde | Uso |
|------|-----|
| `fn_log_mudanca_status_disponibilidade` | `v_auto := ARRAY['disponivel','ausente','ocupado']` |
| `fn_status_equipe_agora` | `THEN 'ocupado'` (regra 1) e `NOT IN (...)` (regra 2) |
| Cron da Opção 2 | `WHERE sd.status NOT IN ('disponivel','ausente','ocupado')` |
| `StatusEquipeRealtime.tsx` | `isManual: !o.sistema && o.slug !== 'ocupado'` |

Trocar o slug quebraria os quatro **em silêncio** — sem erro, só comportamento errado. O mesmo vale para `disponivel` e `ausente`.

### Divergência 3 — status personalizado é mascarado por atendimento

Hoje a regra 1 vence a regra 2: um profissional em "Reunião" que tenha um atendimento `Confirmado` sobreposto aparece como **Ocupado**, enquanto o registro de histórico da reunião segue aberto e contando minutos. A declaração explícita do profissional é sobrescrita por um agendamento que pode nem estar acontecendo (`Confirmado` é estado de agenda, não prova de atendimento).

Isso contradiz diretamente o "início, meio e fim" do item 1: o bloco tem início e fim registrados, mas o **meio fica invisível** — inclusive no card novo da agenda.

**E expõe um problema de C2 que já existe hoje, independente de qualquer mudança deste RFC:** quando um status personalizado se sobrepõe a um atendimento fabril, o mesmo tempo de relógio é contado **duas vezes** no Tempo Fábril — uma vez em `horasAgendamentoMin` e outra em `tempoStatusMin` ([`kpis-tempo-fabril.ts`](../../src/lib/relatorios/kpis-tempo-fabril.ts#L356-L363), que simplesmente soma os dois). É a mesma classe de defeito do fix de julho: duas fontes contando o mesmo fato sem reconciliação.

#### Questão de precedência — DECIDIDA (10/08): Opção A, atendimento vence

| | **Opção A — Atendimento vence** ✅ *decidida* | Opção B — Declaração vence |
|---|---|---|
| Regra | 1. atendimento → 2. personalizado | 1. personalizado → 2. atendimento |
| Coerência com "início, meio e fim" | ⚠️ o meio some da tela — mitigado abaixo | ✅ |
| Fonte da autoridade | Agenda | O profissional |
| Risco | Mascara o status declarado enquanto durar a consulta | Se o profissional esquecer, esconde um atendimento real |
| Esforço | 0 — mantém o `CASE` como está | Inverter duas cláusulas |

**Decisão do approver: manter a Opção A.** "Em atendimento" comunica à equipe que a pessoa está com um paciente e não deve ser interrompida — informação operacionalmente mais útil no momento do que o motivo pelo qual ela estava ocupada antes.

**Mitigação obrigatória no card da agenda.** Como o "meio" do bloco fica invisível no campo de status, o card — que tem mais espaço que o widget — exibe a declaração como informação secundária:

```
Jéssica Teixeira
Em atendimento  ·  declarou: Em reunião (14:00)
                   "alinhamento com a Dra. Marina"
```

Assim o item 1 do PRD ("início, meio e fim") se sustenta na superfície onde a gestão opera, sem alterar a regra de precedência. O status permanece um valor único; a declaração vira contexto adicional, não um segundo status.

**Nota:** esta escolha preserva a contagem dupla no Tempo Fábril (o bloco continua aberto e contando durante a consulta), medida em 0,77% e fora do escopo por materialidade. Sob a Opção B o efeito seria o mesmo — a precedência afeta a exibição, não o registro.

**Em ambas as opções, a contagem dupla no Tempo Fábril precisa ser resolvida à parte**, deduplicando a interseção entre atendimentos fabris e status personalizados no cálculo. Isso é trabalho adicional não previsto no PRD (ver Ação 7 e custo).

---

## Profissional Inativo

Requisito acrescentado em 10/08, motivado por um achado do diagnóstico: **Roberta Aguiar Arruda não faz mais parte do quadro**, e mesmo assim mantém linha em `status_disponibilidade` com `status = 'ocupado'` desde 29/05. Inativar um usuário hoje não limpa nada.

### Estado atual — o filtro existe, mas é inconsistente e só vive no front

`profiles.ativo BOOLEAN DEFAULT true` (nullable) existe desde sempre. Quem respeita:

| Camada | Filtro | Problema |
|--------|--------|----------|
| Relatório Tempo Fábril | `.eq('ativo', true)` na query | **Apaga o passado** — ver decisão abaixo |
| Layout → `profissionais` | `p.ativo !== false` | Aceita `NULL` |
| Layout → `profissionaisWidget` | `p.ativo === true` | Rejeita `NULL` |
| `fn_status_equipe_agora` | **nenhum** | Confia no chamador — e ainda **INSERE** linha para qualquer id recebido |
| Cron `fechar-status-esquecidos` | **nenhum** | Processa registros de inativos indefinidamente |
| Ato de inativar | **nenhum** | Não fecha histórico nem limpa o status ao vivo |

Duas listas na mesma página tratam `ativo IS NULL` de formas opostas (`!== false` vs `=== true`). Como a coluna é nullable com default, linhas antigas podem estar `NULL` — e aí o profissional aparece numa lista e some da outra.

### Princípio: `ativo` governa o presente, não o passado

**Decisão do approver (10/08): preservar o histórico.** O relatório de maio continua mostrando as horas de maio de quem foi desligado em junho. Inativar remove das telas ao vivo e dos períodos posteriores — nunca reescreve o que já aconteceu.

**Isso muda o comportamento atual.** O `.eq('ativo', true)` do Tempo Fábril hoje faz o oposto: desligar alguém apaga retroativamente as horas dela de todos os relatórios passados, mudando o total da equipe em períodos já fechados. É um defeito silencioso de auditoria, e sai nesta entrega.

### Desenho

**a) Regra de inclusão no relatório: presença de dado, não data de corte**

Para um período `[início, fim]`:

```
incluir o profissional  ⟺  ativo = true  OU  tem registro no período
```

Onde *registro* = atendimento fabril ou bloco de status personalizado que intersecte o período.

**Por que não usar a data de desligamento como corte.** A primeira versão desta seção propunha `ativo = true OU inativado_em >= início`. O furo: a inativação costuma ser aplicada *depois* que a pessoa parou de trabalhar — o gestor lembra semanas ou meses depois. Alguém que parou em maio e foi marcado inativo em agosto entraria nos relatórios de junho e julho com **zero horas**, arrastando a média da equipe para baixo em períodos em que sequer estava lá.

A regra por presença de dado não tem esse furo, e se comporta corretamente nos três casos:

| Caso | Resultado |
|------|-----------|
| Desligada, relatório de maio (trabalhou) | ✅ entra — tem atendimentos no período |
| Desligada, relatório de agosto | ✅ sai — nenhum registro |
| Ativo de férias em agosto | ✅ entra com 0h, marcado como subutilizado — correto, está na folha |

**Efeito colateral bem-vindo: elimina o backfill.** Não é preciso descobrir quando cada inativo atual foi desligado, porque a regra não depende dessa data.

**b) Registrar a data de desligamento — para auditoria, não para o cálculo**

`profiles.inativado_em TIMESTAMPTZ`, preenchido com `NOW()` pelo trigger do item (c) quando `ativo` vai de `true → false`. Serve para auditoria e para o rótulo "(inativo desde X)" na tela.

Inativos atuais ficam com `NULL` — a data nunca foi registrada em lugar nenhum (`profiles` não tem `updated_at`) e, pela regra do item (a), não faz falta.

**c) Inativar passa a limpar o estado ao vivo**

Trigger `AFTER UPDATE OF ativo ON profiles`, disparando quando `true → false`:

1. Grava `inativado_em = NOW()`.
2. Fecha qualquer registro aberto em `historico_status_disponibilidade` (`fim = NOW()`).
3. Remove a linha de `status_disponibilidade`.

No trigger, e não na action, porque assim vale para **todo** caminho que inativa — tela, script, SQL manual. O histórico permanece intacto; só o estado presente é limpo.

**d) Normalizar o `ativo` nulo**

```sql
UPDATE profiles SET ativo = true WHERE ativo IS NULL;
ALTER TABLE profiles ALTER COLUMN ativo SET NOT NULL;
```

Com isso `!== false` e `=== true` passam a ser equivalentes, e a divergência entre as duas listas do layout desaparece na origem em vez de ser remendada nos dois pontos.

**e) Defesa em profundidade nas camadas ao vivo**

- Cron `fechar-status-esquecidos`: `JOIN profiles p ON p.id = ... AND p.ativo` nos dois `UPDATE`s.
- `fn_status_equipe_agora`: ignorar ids de inativos, e **nunca inserir** linha para eles.
- Card novo da agenda: filtrar `ativo = true` — herda o comportamento correto desde o primeiro commit.

O item (c) já torna (e) redundante para o fluxo futuro. Mantido porque (e) protege contra linhas que já escaparam — como a da Roberta, viva em `status_disponibilidade` desde 29/05.

**Custo:** ~1d — mesmo com o item (a) mais elaborado, some o backfill de datas de desligamento.

---

## Suposições

| # | Suposição | Owner | Confiança | Gatilho de invalidação |
|---|-----------|-------|-----------|------------------------|
| 1 | 1h é o teto correto de um bloco de status personalizado; ficar mais tempo exige reafirmar o status | @Dr. Felipe | **Alta** (decisão do dono) | Se reuniões de 2h+ forem rotina, o atrito de reafirmar pode gerar sub-registro sistemático no Tempo Fábril |
| 2 | Voltar automaticamente para "Disponível" é aceitável para o profissional — não gera reclamação de "o sistema me marcou disponível durante minha reunião" | Gestão | **Média** | Se gerar atrito, mitigar com aviso no app antes de expirar (fora do escopo desta entrega) |
| 3 | ~~`pg_cron` está ativo e rodando de fato~~ → **CONFIRMADO em 2026-08-10** | Engenharia | ✅ **Verificada** | 2.574 execuções bem-sucedidas, última há 5s. Ver Dados Relevantes |
| 3b | ~~Não há escritores legados de `status_disponibilidade`~~ → **PARCIALMENTE FALSA (10/08)** | Engenharia | ✅ **Verificada** | Cron de minuto: não existe. Trigger `trg_concluir_atendimento`: ativo, sem dano material observado, mas removido no escopo (~0,5d) |
| 4 | Observação é texto curto e livre (não estruturado, sem vínculo com paciente/atendimento) | @Raniery | Alta | Se a gestão pedir vínculo com paciente ou categorias fechadas, o modelo de dados muda |
| 5 | A observação pode ser lida por qualquer usuário autenticado | Gestão | **Média** — decidido, mas revisável | Se alguém escrever conteúdo sensível (saúde, pessoal) numa observação, vira questão de LGPD e exige RLS restritiva |
| 6 | Realtime (`useRealtimeDisponibilidade`) propaga updates feitos pelo `pg_cron`, não só os feitos via API | Engenharia | **Baixa** | Se não propagar, o card fica desatualizado até o refresh. Mitigação: recalcular tempo decorrido no cliente e tratar `> 1h` como expirado |

---

## Critérios de Decisão

Definidos **antes** das opções.

| # | Critério | Peso | Tipo |
|---|----------|------|------|
| C1 | **Uma só fonte da verdade** — tela ao vivo e relatório nunca discordam sobre o mesmo fato | 5 | **Must-have** |
| C2 | **Não corromper o Tempo Fábril** — nenhuma mudança pode inflar ou duplicar horas já registradas | 5 | **Must-have** |
| C3 | **Rastreabilidade** — todo bloco de status personalizado tem contexto legível pela gestão | 4 | Alto |
| C4 | **Visibilidade na agenda** — quem coordena vê o estado sem trocar de rota | 4 | Alto |
| C5 | **Baixo atrito diário** — não transformar troca de status em formulário | 3 | Médio |
| C6 | **Custo de implementação** — esforço e risco de regressão em produção | 3 | Médio |
| C7 | **Reversibilidade** — dá para voltar atrás sem perder dados | 2 | Baixo |

---

## Opções Consideradas

### Opção 0 — Não fazer nada

Manter status sem observação, sem card na agenda, com fallback de 2h que só fecha o histórico.

**Prós:** custo zero; nenhum risco de regressão.
**Contras:** nenhuma demanda do PRD atendida; o estado "travado em reunião" segue em produção; Tempo Fábril continua não auditável.
**Avaliação:** falha C1, C3, C4. Serve apenas como linha de base.

---

### Opção 1 — Implementação literal do PRD

Três mudanças mínimas, exatamente como escritas:
- Coluna `observacao` em `status_disponibilidade`, opcional, campo livre no widget.
- Card na agenda reusando o `StatusEquipeRealtime` existente.
- `INTERVAL '2 hours'` → `INTERVAL '1 hour'` no cron.

**Prós**
- Menor esforço (~1–2 dias).
- Zero mudança de comportamento para o profissional.
- Reversível trivialmente.

**Contras**
- **Não corrige o defeito do fallback** — só antecipa a divergência de 2h para 1h.
- O card publica o estado travado com mais destaque do que hoje.
- Observação opcional em `status_disponibilidade` (não no histórico) significa que ela é **sobrescrita na próxima troca de status**: a observação da reunião de segunda some quando o profissional entra em hora administrativa na terça. O relatório de Tempo Fábril, que lê o histórico, nunca vê observação nenhuma — o item 1 do PRD não entrega o valor pretendido.
- `StatusEquipeRealtime` não tem slot para observação nem para tempo decorrido em status — reusar exige modificá-lo de qualquer forma.

**Custo:** ~1–2 dias.
**Avaliação:** **falha C1** (must-have). Falha C3 na prática. Atende C4 parcialmente.

---

### Opção 2 — Ciclo de vida completo do status ✅ **RECOMENDADA**

Tratar cada bloco de status personalizado como um evento com **início, contexto e fim garantido**.

**a) Observação com lastro no histórico**

- `status_disponibilidade.observacao TEXT` — o que está valendo agora.
- `historico_status_disponibilidade.observacao TEXT` — cópia gravada na abertura do registro, imutável depois. É o que o Tempo Fábril e qualquer auditoria leem.
- `status_disponibilidade_opcoes.observacao_obrigatoria BOOLEAN DEFAULT false` — o gestor decide, por status, se exige justificativa. Configurado na tela que já existe em Configurações → Status de disponibilidade.
- Validação **server-side** em `setStatusDisponibilidade`, não só no formulário.
- Leitura liberada para qualquer usuário autenticado (mesma política de `status_disponibilidade` hoje — sem RLS nova).

**b) Fallback que devolve o profissional ao estado normal**

O job passa a fazer duas coisas, **nesta ordem** (a ordem importa — ver Riscos):

```sql
-- 1º: fecha o histórico capando em 1h
UPDATE historico_status_disponibilidade
SET fim = inicio + INTERVAL '1 hour'
WHERE fim IS NULL AND inicio < NOW() - INTERVAL '1 hour';

-- 2º: devolve o profissional para "Disponível"
UPDATE status_disponibilidade sd
SET status = 'disponivel', origem = 'fallback', atualizado_em = NOW()
WHERE sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
  AND sd.atualizado_em < NOW() - INTERVAL '1 hour';
```

Assim que o status manual sai do caminho, a `fn_status_equipe_agora` volta a resolver por jornada/atendimento sozinha. Frequência do cron permanece a cada 10 minutos. (A função em si muda por outro motivo — a inversão de precedência do item **d**.)

**c) Card na agenda**

Novo componente na rota de agendamento mostrando, por profissional em status personalizado: **nome · status (cor do catálogo) · observação · tempo decorrido**. Assinado no realtime que já existe (`useRealtimeDisponibilidade`), com recálculo do tempo no cliente. Profissionais em `disponivel`/`ausente` ficam agrupados/compactos para não poluir a agenda.

Quando houver atendimento em curso sobre um status declarado, o card mostra **os dois** — `Em atendimento · declarou: Em reunião (14:00)` com a observação embaixo. Ver "Questão de precedência". Filtra `ativo = true` (seção Profissional Inativo).

**d) Contrato dos status operacionais explicitado e corrigido**

Conforme a seção "Contrato dos Status": `ocupado` reclassificado como `sistema = true`, renomeado para "Em atendimento" (label apenas, slug preservado), e a cadeia de resolução documentada junto da `fn_status_equipe_agora`. **A precedência não muda** — decisão do approver em 10/08: atendimento continua vencendo a declaração. Em contrapartida, o card do item (c) exibe a declaração como informação secundária, para que o "meio" do bloco não fique invisível.

**e) Profissional inativo deixa de contar**

Conforme a seção "Profissional Inativo": relatório passa a incluir por **presença de dado no período** em vez de filtrar por `ativo`, trigger de limpeza na inativação, `inativado_em` para auditoria, e `ativo` normalizado para `NOT NULL`. O histórico é preservado — inativar deixa de reescrever relatórios de períodos passados, como acontece hoje.

**Prós**
- Único caminho em que tela e relatório sempre concordam (**C1**).
- Fecha três defeitos silenciosos do catálogo de operacionais que ninguém tinha reportado (**C1**).
- Observação sobrevive à troca de status e vira dado auditável no Tempo Fábril (**C3**).
- Obrigatoriedade por status equilibra rastreabilidade e atrito: exige em "Reunião", dispensa em "Almoço" (**C3 + C5**).
- O fallback deixa de ser válvula de emergência e vira regra de negócio explícita, alinhada ao que o dono pediu: *"se precisar ficar por mais tempo será necessário mudar o status novamente"*.

**Contras**
- Maior superfície: trigger, cron, action, catálogo e dois componentes.
- **Introduz sub-registro no Tempo Fábril**: uma reunião real de 3h passa a contar 1h por bloco reafirmado. Se o profissional não reafirmar, perdem-se 2h de tempo fábril legítimo. Isso é uma **decisão de negócio consciente** (Suposição 1), não um efeito colateral — mas precisa ser comunicada à equipe antes do go-live.
- Exige backfill de decisão sobre os registros hoje travados em `status_disponibilidade` (ver Ação 11).

**Custo:** ~8 dias (ver tabela de Custo Estimado) — a dedup da contagem dupla saiu do escopo por medição (0,77%), e entraram a remoção do `trg_concluir_atendimento` e o tratamento de profissional inativo. Todas as consultas pré-decisão estão concluídas.
**Avaliação:** atende C1, C2, C3, C4, C5, C7. Custo médio (C6).

---

### Opção 3 — Status com duração declarada na entrada

O profissional escolhe, ao assumir o status, quanto tempo pretende ficar (30min / 1h / 2h / personalizado). O sistema expira exatamente nesse prazo.

**Prós**
- Mais fiel à realidade: uma reunião de 2h é registrada como 2h, sem sub-registro.
- Elimina a arbitrariedade do teto único.
- Permite avisar o profissional antes de expirar.

**Contras**
- Mais atrito por troca de status (duração + observação = dois campos).
- **Contraria a instrução explícita do dono**, que pediu teto fixo com reafirmação obrigatória. Reabre uma decisão já tomada.
- Duração declarada vira nova fonte de imprecisão (o profissional declara 2h e sai em 20min → tempo fábril inflado, que é exatamente o que o fix de julho combateu).
- Ainda precisa de um fallback para quem declara e não volta — não substitui a Opção 2, se soma a ela.

**Custo:** ~11 dias — é a **Opção 2 inteira (~8d) mais ~3d** de duração declarada, expiração por prazo e aviso ao profissional. Não é alternativa mais barata: é um incremento sobre ela.
**Avaliação:** atende C1–C4, mas **falha C5** e conflita com a diretriz do approver. Fica registrada como **evolução futura**, uma vez que a Opção 2 esteja estável e tivermos dados reais sobre quantos blocos são reafirmados.

---

## Comparativo

| Critério | Peso | Op. 0 | Op. 1 | **Op. 2** | Op. 3 |
|----------|:----:|:-----:|:-----:|:---------:|:-----:|
| C1 Fonte única da verdade | 5 | ❌ | ❌ | ✅ | ✅ |
| C2 Não corromper Tempo Fábril | 5 | ✅ | ✅ | ⚠️ sub-registro consciente | ⚠️ risco de inflar |
| C3 Rastreabilidade | 4 | ❌ | ⚠️ observação volátil | ✅ | ✅ |
| C4 Visibilidade na agenda | 4 | ❌ | ⚠️ | ✅ | ✅ |
| C5 Baixo atrito | 3 | ✅ | ✅ | ⚠️ | ❌ |
| C6 Custo | 3 | ✅ 0d | ✅ 1–2d | ⚠️ ~8d | ❌ ~11d |
| C7 Reversibilidade | 2 | ✅ | ✅ | ✅ | ⚠️ |

Opções 0 e 1 falham um **Must-have** (C1) e estão descartadas por isso, independentemente de pontuação. Entre 2 e 3, a Opção 2 vence em C5 e C6 e respeita a diretriz do approver — e a Opção 3 não é uma alternativa a ela, é um incremento por cima dela (~8d + ~3d), o que reforça fazer a 2 primeiro e reavaliar com dados reais.

---

## Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|:----------:|-----------|
| **Ordem das operações no cron.** Se o `UPDATE status_disponibilidade` rodar antes de fechar o histórico, o trigger fecha o registro com `fim = NOW()` — que pode ser muito maior que 1h — e infla o Tempo Fábril | **Alta** | Ordem fixa e documentada no SQL: fechar histórico primeiro. Teste explícito com registro de 5h aberto |
| **`pg_cron` pode não estar ativo.** Todo o desenho do fallback pressupõe que ele roda | **Alta** | Verificar em produção **antes de implementar** (`verificar_cron_fallback.sql`, seção 2 — checa `cron.job_run_details`). Se não estiver, usar a rota de API + crontab do SO já esboçada em [`fix_reuniao_duplicidade_migration.sql`](../../database/fix_reuniao_duplicidade_migration.sql#L47-L55) |
| **Trigger é `AFTER UPDATE OF status`.** Editar só a observação, sem trocar o status, não dispara nada — e `setStatusDisponibilidade` usa `upsert`, então o **INSERT** de um profissional novo também não dispara | Média | Decidir explicitamente: ou a observação só é definida no ato da troca (mais simples, alinhado ao PRD), ou o trigger vira `AFTER INSERT OR UPDATE`. Recomendação: **só no ato da troca**, e o widget bloqueia o early-return `if (novoStatus === myStatus) return` quando houver observação nova |
| **Realtime pode não propagar update do `pg_cron`** | Média | Card recalcula tempo decorrido no cliente e trata `> 1h` como estado expirado, mesmo sem evento. Validar a publication da tabela |
| **Registros hoje travados** em `status_disponibilidade` com status manual antigo | Média | Script de limpeza único no deploy, alinhado com a auditoria de limpeza que está pausada desde o fix de julho |
| **Contagem dupla atendimento × status personalizado** no Tempo Fábril — pré-existente, não introduzida por este RFC | **Alta** | Deduplicar a interseção no cálculo (Ação 7). Medir o impacto retroativo antes (Ação 3): se for material, números de Tempo Fábril já usados em decisão estão superestimados |
| **Trocar o slug** `ocupado`/`disponivel`/`ausente` quebraria 4 pontos sem erro visível | **Alta** | Renomear **apenas** `label` e `label_curto`. Comentar os 4 pontos marcando o slug como contrato |
| **Inverter a precedência** pode esconder um atendimento real se o profissional esquecer o status | Média | O teto de 1h limita a janela. Validar na revisão de 2 semanas (Ação 13) |
| **Reação da equipe** ao ser marcada "Disponível" durante uma reunião real | Média | Comunicar antes do go-live. Acompanhar por 2 semanas quantos blocos são reafirmados — é o dado que decide se a Opção 3 volta à mesa |

---

## Custo Estimado

| Frente | Esforço | Observação |
|--------|:-------:|------------|
| Migration: colunas `observacao` (×2) + `observacao_obrigatoria` | 0,5d | Aditivo, sem `NOT NULL` — não quebra nada existente |
| Trigger: propagar observação para o histórico | 0,5d | Área sensível — exige teste de regressão do Tempo Fábril |
| Cron: cap 1h + reset de status, na ordem correta | 1d | Inclui verificação do `pg_cron` em produção |
| Action + validação server-side de obrigatoriedade | 0,5d | |
| Tela de catálogo: toggle "exige observação" | 0,5d | Estende a tela existente |
| Widget: campo de observação na troca de status | 1d | Mudar o fluxo de clique-único para clique + confirmação |
| Card na agenda | 1,5d | Componente novo; layout da agenda já é apertado (grid 12 colunas) |
| Contrato dos operacionais: `ocupado` → `sistema = true`, rename de label, inversão de precedência | 0,5d | One-liner no catálogo + duas cláusulas do `CASE`. Fecha 3 defeitos silenciosos |
| ~~Dedup da interseção atendimento × status~~ | ~~1,5d~~ | ❌ **Fora do escopo** — medido em 0,77%, abaixo do limiar. Vai para backlog, remedir após o fallback de 1h |
| Remover `trg_concluir_atendimento` + funções órfãs | 0,5d | Verificado em 10/08: ativo, sem dano acumulado, mas incompatível com o contrato da Opção 2 |
| Profissional inativo: regra por presença de dado, `inativado_em`, trigger de limpeza, `ativo NOT NULL`, filtros | 1d | Inclui trocar o `.eq('ativo', true)` do Tempo Fábril, que hoje apaga o passado. Sem backfill de datas |
| Backfill + validação em produção | 0,5d | Inclui os 3 travados e os 2 resíduos em `'ocupado'` (um desde 29/05, de profissional já desligado) |
| **Total** | **~8d** | |

---

## Action Items

### Antes da decisão — três consultas ao banco

Queries prontas em [`database/diagnostico_status_personalizados.sql`](../../database/diagnostico_status_personalizados.sql) — somente leitura. Exigem o SQL Editor do Studio (`cron.*` e agregações não saem via REST).

| # | Ação | Owner | Resultado |
|---|------|-------|-----------|
| 1 | ~~`pg_cron` está ativo e rodando?~~ | Engenharia | ✅ **Feito 10/08** — sim, 2.574 sucessos. Plano B descartado |
| 2 | ~~Quantos profissionais travados?~~ | Engenharia | ✅ **Feito 10/08** — 3 travados, um há 2d20h. Defeito confirmado |
| 3 | ~~A contagem dupla é material?~~ | Engenharia | ✅ **Feito 10/08** — 0,77%. Abaixo do limiar → dedup sai do escopo |
| 3b | ~~Escritores legados ainda ativos?~~ | Engenharia | ✅ **Feito 10/08** — cron morto; trigger `trg_concluir_atendimento` ativo mas sem dano acumulado. Não bloqueia; entra no escopo |

**Todas as consultas pré-decisão estão concluídas. A RFC está pronta para aprovação.**

### Decisão

| # | Ação | Owner |
|---|------|-------|
| 4 | Aprovar esta RFC (Opção 2) e resolver as Questões em Aberto 1 e 4 | @Dr. Felipe |

### Execução

| # | Ação | Owner | Bloqueia |
|---|------|-------|----------|
| 5 | Migration das três colunas (`observacao` ×2 + `observacao_obrigatoria`) | Engenharia | 6, 9 |
| 6 | Trigger + cron (ordem correta) + teste de regressão do Tempo Fábril | Engenharia | 11 |
| 7 | ~~Deduplicar a interseção no Tempo Fábril~~ → **backlog** (0,77%, abaixo do limiar). Remedir após o fallback de 1h | Engenharia | — |
| 7b | Remover `trg_concluir_atendimento` + funções órfãs (`fn_trigger_concluir_atendimento`, `fn_atualizar_status_em_atendimento`) | Engenharia | 6, 11 |
| 7c | Profissional inativo: regra por presença de dado no relatório, `inativado_em`, trigger de limpeza, `ativo NOT NULL`, filtros nas camadas ao vivo | Engenharia | 10, 11 |
| 8 | Contrato dos operacionais: `ocupado` → `sistema = true`, rename para "Em atendimento" (precedência mantida) | Engenharia | 10 |
| 9 | Front: observação no widget + toggle no catálogo | Engenharia | 11 |
| 10 | Card na rota de agendamento | Engenharia | 11 |
| 11 | Backfill dos registros travados + validação em produção | Engenharia | 12 |
| 12 | Comunicar a equipe: teto de 1h, reafirmação obrigatória e rename de "Ocupado" | Gestão | — |

### Depois do go-live

| # | Ação | Owner | Prazo |
|---|------|-------|-------|
| 13 | Revisar % de blocos reafirmados vs. expirados — decide se a Opção 3 volta à mesa | Gestão + Engenharia | +2 semanas |

---

## Outcome

*A ser preenchido após a decisão.*

- **Decisão:**
- **Data:**
- **Decidido por:**
- **Justificativa:**
- **Divergências registradas:**

---

## Questões em Aberto

1. ~~Observação editável durante o status?~~ → **DECIDIDO (10/08): não.** A observação é escrita no ato da escolha do status e não é editada depois. Se a pessoa errar o texto, troca o status novamente — coerente com o modelo de reafirmação a cada 1h, e não exige mexer no trigger.
2. ~~Precedência entre atendimento e status personalizado?~~ → **DECIDIDO (10/08): atendimento vence**, mantendo o comportamento atual. Mitigado pela exibição dupla no card.
3. ~~A contagem dupla retroativa é material?~~ → **MEDIDO (10/08): 0,77%**, abaixo do limiar. Fora do escopo, vai para backlog.
4. **O card na agenda deve mostrar horas acumuladas no dia?** O PRD menciona *"ver as horas que esse colaborador fez lá"*. A Opção 2 entrega tempo decorrido do bloco atual; acumulado do dia exige query agregada adicional na rota de agendamento. **Única questão ainda aberta** — escopo opcional, decidir na implementação.
