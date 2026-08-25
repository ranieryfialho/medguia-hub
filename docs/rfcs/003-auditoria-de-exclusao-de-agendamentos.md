# RFC: Auditoria de Exclusão de Agendamentos — Motivo Obrigatório, Log Imutável e Aba de Logs no Paciente

| Campo | Valor |
|-------|-------|
| **Impacto** | **ALTO** — toda exclusão de agendamento passa a exigir motivo e a gravar log. Afeta recepção (fluxo diário), gestão (nova superfície de auditoria) e o caminho de exclusão em produção, que hoje é `DELETE` direto sem rastro. Tabela nova com RLS própria. |
| **Status** | **READY FOR DECISION** |
| **Driver** | @Raniery |
| **Approver** | @Dr. Felipe (dono) |
| **Contributors** | Engenharia (MedGuia Hub), Coordenação de Recepção |
| **Informed** | Recepção, fisioterapeutas e médicos |
| **Due Date** | TBD — sugerido decidir em até 1 semana |
| **Resources** | [PRD 003](../prds/003-sistema-de-logs-e-motivo-de-exclusao-de-agendamentos.md) · [RFC 002](002-ciclo-de-vida-dos-status-personalizados.md) |
| **Created** | 2026-08-25 |
| **Last Updated** | 2026-08-25 |

---

## Sumário Executivo

O PRD 003 pede três coisas: **motivo obrigatório** na exclusão, **log de auditoria imutável** e **visualização** (aba do paciente + painel gerencial).

Ao levantar o código para dimensionar a entrega, três achados mudam o enquadramento — nenhum deles está no PRD, e dois deles são defeitos ativos hoje:

> **1. A regra "não excluir Concluído" só existe no navegador.** [`AgendamentoModal.tsx:415`](../../src/components/features/agenda/AgendamentoModal.tsx#L415) esconde o botão quando `isConcluido`, e as quatro Server Actions de exclusão **não checam status nenhum**. Pior: [`deletarTodasRecorrencias`](../../src/actions/agenda.ts#L1056) faz `DELETE ... WHERE agendamento_id = X` **sem filtrar status** — apagar a série de um paciente com 12 sessões já concluídas apaga as 12. O PRD lista isso em "NUNCA PODE" como *"regra já existente mantida"*. A regra não existe onde importa.

> **2. Não há transação.** O cliente Supabase JS não abre transação. Qualquer desenho que grave o log na Server Action é *duas viagens ao banco*: se a segunda falhar, ou o atendimento some sem log, ou fica um log de exclusão que não aconteceu. O PRD exige atomicidade explicitamente ("NUNCA PODE: falha na gravação do log resultar em exclusão silenciosa").

> **3. RLS não torna a tabela imutável.** Todas as exclusões passam por `supabaseAdmin` (service role), que **ignora RLS por definição**. Uma política `FOR UPDATE USING (false)` dá falsa sensação de append-only: o mesmo código que grava o log pode reescrevê-lo. Imutabilidade real exige trigger `BEFORE UPDATE OR DELETE`.

Há ainda um detalhe de comportamento que o log precisa registrar corretamente: excluir uma sessão pontual de recorrência **não reduz a série** — [`deletarAtendimentoPontualDaRecorrencia`](../../src/actions/agenda.ts#L1001-L1049) insere uma sessão nova no fim e atualiza `total_sessoes`. É uma *reposição*, não uma perda. Um log que não distinga os dois casos produz métrica de perda inflada logo no primeiro relatório.

**Recomendação: Opção 2 — mover a exclusão para uma função `SECURITY DEFINER` no Postgres, que valida, registra e apaga na mesma transação.** As Server Actions passam a ser uma casca fina que autentica, resolve o operador e chama a RPC. Motivo obrigatório validado no servidor, snapshot capturado dentro da transação, log protegido por trigger, e a aba **Logs** na rota `/pacientes/[id]` como superfície de leitura principal.

---

## Background

### Situação atual

A exclusão de agendamentos tem quatro caminhos, todos em [`src/actions/agenda.ts`](../../src/actions/agenda.ts), todos chamados a partir do [`AgendamentoModal`](../../src/components/features/agenda/AgendamentoModal.tsx) e do [`ModalSelecaoExclusao`](../../src/components/features/agenda/ModalSelecaoExclusao.tsx):

| Escopo | Action | O que faz hoje |
|--------|--------|----------------|
| Avulso / sessão única | [`deletarAgendamento`](../../src/actions/agenda.ts#L877) | `DELETE` no atendimento; se a série ficar vazia, apaga a linha em `agendamentos` |
| Pontual da recorrência | [`deletarAtendimentoPontualDaRecorrencia`](../../src/actions/agenda.ts#L954) | `DELETE` + **repõe** a sessão no fim da série |
| Série completa | [`deletarTodasRecorrencias`](../../src/actions/agenda.ts#L1056) | `DELETE` por `agendamento_id` — **sem filtro de status** |
| Selecionados em lote | [`deletarAtendimentosSelecionados`](../../src/actions/agenda.ts#L1090) | `DELETE ... IN (ids)` |

As quatro compartilham a mesma estrutura: `requirePermissaoAgendaAdmin()` → `supabaseAdmin.delete()` → `revalidatePath()`. **Nenhuma delas grava qualquer registro do que foi apagado.** O único rastro é o `console.error` no caminho de falha.

Existe precedente de tabela de auditoria no projeto: [`confirmacoes_auditoria`](../../database/confirmacoes_auditoria_migration.sql), com `usuario_id`, `usuario_nome`, `criado_em`, `metadata JSONB`. É o formato certo — mas com um detalhe que **não pode ser copiado**: `atendimento_id UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE`. Numa tabela cujo propósito é sobreviver à exclusão do atendimento, `CASCADE` apagaria o log no exato instante em que ele passa a importar.

A rota `/pacientes/[id]` já tem a estrutura de abas pronta em [`PacienteTabsClient.tsx`](../../src/components/features/pacientes/PacienteTabsClient.tsx) — sete abas, cada uma com gate opcional por módulo (`modulosLiberados`). Adicionar uma aba é acrescentar uma entrada no array `TABS` e um branch no render.

### O problema

**1. Exclusão é indistinguível de erro de sistema.** Quando um atendimento some da agenda, não há como saber se foi desistência, erro de digitação, reagendamento mal feito ou ação não autorizada. A recepção e o corpo clínico discutem sobre um fato que ninguém consegue reconstruir.

**2. A proteção do histórico concluído é decorativa.** Ver achado 1 acima. É o defeito mais grave levantado, porque destrói dado clínico irrecuperável e **não depende deste RFC ser aprovado para ser corrigido** — mas o caminho de correção é exatamente o mesmo código que este RFC reescreve.

**3. Não há dado de gestão sobre perdas.** Sem categoria de motivo, não dá para responder "quantos cancelamentos por questão financeira tivemos em julho?" — pergunta que hoje só tem resposta anedótica.

### Por que agora

1. O defeito do `deletarTodasRecorrencias` está ativo em produção e apaga histórico clínico. Corrigi-lo isolado significa mexer nas mesmas quatro actions duas vezes.
2. As quatro actions são estruturalmente idênticas. Consolidá-las agora custa uma vez; consolidá-las depois de já existir uma quinta variante custa mais.
3. A base tem 9.866 pacientes migrados e histórico desde 2022 ([memória de migração](../../PLANO_MIGRACAO_SUPABASE_POSTGRES.md)). Cada semana sem log é uma semana de exclusões que **não dá para auditar retroativamente** — o dado não existe em lugar nenhum, nem em backup, porque o `DELETE` é físico.

### O que acontece se não decidirmos

O `DELETE` continua físico e anônimo; a proteção do histórico concluído continua contornável por qualquer chamada direta à action; e a gestão continua investigando "consulta sumida" por conversa.

---

## Dados Relevantes

**Levantamento de código (25/08/2026)** — o que está verificado:

| Achado | Evidência | Verificado |
|--------|-----------|-----------|
| Nenhuma das 4 actions grava log | `grep` por `auditoria`/`log` em `agenda.ts` → zero ocorrências no caminho de exclusão | ✅ |
| Nenhuma das 4 actions valida `status = 'Concluído'` | Única ocorrência de `'Concluído'` no arquivo é em [`buscarAtendimentosPendentesRecorrencia`](../../src/actions/agenda.ts#L1084), que é *listagem*, não exclusão | ✅ |
| `deletarTodasRecorrencias` apaga concluídos | `DELETE ... .eq('agendamento_id', id)` sem `.neq('status', ...)` | ✅ |
| A proteção só existe no front | [`AgendamentoModal.tsx:415`](../../src/components/features/agenda/AgendamentoModal.tsx#L415) | ✅ |
| Exclusão pontual repõe a sessão | [`agenda.ts:1001-1049`](../../src/actions/agenda.ts#L1001-L1049) — insere nova sessão e incrementa `total_sessoes` | ✅ |
| `confirmacoes_auditoria` usa `ON DELETE CASCADE` | [migration](../../database/confirmacoes_auditoria_migration.sql) | ✅ |

**Não medido — entra como consulta pré-decisão (Ação 1):** volume atual de exclusões por semana. Ele não muda a recomendação, mas dimensiona o painel gerencial (paginação, índices) e serve de linha de base para a métrica de "0% de exclusões sem justificativa".

---

## Suposições

| # | Suposição | Owner | Confiança | Gatilho de invalidação |
|---|-----------|-------|-----------|------------------------|
| 1 | A recepção aceita um passo a mais na exclusão, desde que resolvido em ~2 cliques | Coordenação | **Média** | Se virar reclamação recorrente, revisar a lista de motivos (excesso de opções é a causa provável, não o passo em si) |
| 2 | A lista de motivos do PRD cobre a maioria dos casos reais; "Outros" é exceção, não regra | Coordenação | **Média** | Se "Outros" passar de ~20% dos logs em 30 dias, a taxonomia está errada e precisa de revisão com base nos textos livres |
| 3 | Exclusão física (hard delete) + snapshot no log é suficiente para a V1 — não é preciso restaurar | @Dr. Felipe | **Alta** (definido no PRD, "Fora do Escopo") | Se surgir pedido de "desfazer exclusão", o snapshot permite reconstruir manualmente, mas sem garantia de FKs (mídias, prontuário, venda vinculada) |
| 4 | O snapshot pode ser lido por qualquer usuário autenticado com acesso ao paciente | Gestão | **Média** | O snapshot contém dado de saúde (tipo de procedimento, protocolo). Se a política de acesso a paciente mudar, a RLS do log precisa acompanhar |
| 5 | `SECURITY DEFINER` é aceitável como padrão neste projeto | Engenharia | **Alta** | Já usado em `fn_status_equipe_agora`; sem restrição conhecida na infra self-hosted |
| 6 | Ninguém depende hoje de excluir uma série inteira *incluindo* sessões concluídas | Coordenação | **Média** | Se for prática usada para "limpar" cadastros duplicados, é preciso um caminho explícito e logado para isso, em vez do bloqueio seco |

---

## Critérios de Decisão

Definidos **antes** das opções.

| # | Critério | Peso | Tipo |
|---|----------|------|------|
| C1 | **Atomicidade** — é impossível existir exclusão sem log, ou log sem exclusão | 5 | **Must-have** |
| C2 | **Imutabilidade real** — o log não pode ser alterado nem apagado, inclusive pelo service role | 5 | **Must-have** |
| C3 | **Autoria garantida** — nenhuma exclusão anônima; operador resolvido a partir da sessão, nunca do payload do cliente | 5 | **Must-have** |
| C4 | **Cobertura dos 4 escopos** — avulso, pontual, série completa e lote, sem caminho lateral | 5 | **Must-have** |
| C5 | **Proteção do histórico concluído** aplicada no servidor | 4 | Alto |
| C6 | **Visibilidade** — aba no paciente + filtros para gestão | 4 | Alto |
| C7 | **Baixo atrito** — modal resolvido em < 10s (métrica do PRD) | 3 | Médio |
| C8 | **Custo e risco de regressão** em código de produção que roda todo dia | 3 | Médio |
| C9 | **Reversibilidade** — dá para voltar atrás sem perder o que já foi logado | 2 | Baixo |

**Regra de decisão:** opção que falhe qualquer Must-have está descartada, independentemente de custo.

---

## Opções Consideradas

### Opção 0 — Não fazer nada

Manter o `DELETE` direto sem motivo e sem log.

**Prós:** custo zero; nenhum risco de regressão.
**Contras:** nenhuma demanda do PRD atendida; o defeito do histórico concluído segue ativo; cada dia sem log é dado que não existe em backup nenhum, porque a exclusão é física.
**Avaliação:** falha C1–C6. Linha de base apenas.

---

### Opção 1 — Log na Server Action (implementação literal do PRD)

Criar `agendamentos_auditoria`, e em cada uma das quatro actions: capturar snapshot → inserir log → apagar. Motivo validado na action.

**Como funciona**
1. `SELECT` dos dados do(s) atendimento(s) com joins de paciente e profissional.
2. `INSERT` no log.
3. `DELETE` do(s) atendimento(s).
4. Se o `DELETE` falhar, tentar `DELETE` do log inserido (compensação).

**Prós**
- Menor esforço; todo o código fica em TypeScript, sem SQL novo além da tabela.
- Fácil de revisar e testar com as ferramentas já usadas no projeto.

**Contras**
- **Não é atômico.** São três viagens ao banco sem transação. Um timeout entre (2) e (3) deixa log de uma exclusão que não aconteceu; a compensação em (4) é ela mesma uma quarta viagem que pode falhar. O PRD proíbe exatamente isso.
- **Quatro pontos de aplicação da regra.** A validação de motivo, a checagem de concluído e a gravação do log ficam replicadas nas quatro actions. Uma quinta action de exclusão criada no futuro nasce sem nenhuma das três.
- **Imutabilidade fica só na RLS**, que o service role ignora. A própria compensação do passo (4) é a prova: o código *precisa* poder apagar log para funcionar — ou seja, o desenho é incompatível com append-only.

**Custo:** ~3d.
**Avaliação:** **falha C1 e C2** (Must-haves), e falha C4 na prática (regra replicada, não centralizada).

---

### Opção 2 — Exclusão transacional no Postgres ✅ **RECOMENDADA**

Uma função `SECURITY DEFINER` passa a ser o **único** caminho de exclusão. As Server Actions viram cascas finas: autenticam, resolvem o operador a partir da sessão e chamam a RPC.

**a) Tabela append-only, sem `CASCADE`**

```sql
CREATE TABLE agendamentos_auditoria (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acao               TEXT        NOT NULL,   -- exclusao_avulso | exclusao_sessao_recorrente
                                             -- exclusao_serie_completa | exclusao_lote
  motivo_categoria   TEXT        NOT NULL,
  motivo_observacao  TEXT,
  usuario_id         UUID        NOT NULL,   -- sem FK: profile removido não pode apagar o log
  usuario_nome       TEXT        NOT NULL,
  paciente_id        UUID,                   -- sem FK, ON DELETE SET NULL não serve: queremos o id mesmo
  paciente_nome      TEXT        NOT NULL,
  profissional_id    UUID,
  profissional_nome  TEXT,
  atendimento_id     UUID        NOT NULL,   -- id do registro apagado, SEM FK
  agendamento_id     UUID,                   -- série de origem, se houver
  dados_agendamento  JSONB       NOT NULL    -- snapshot completo
);
```

**Nenhuma FK para `atendimentos`, `pacientes` ou `profiles`.** É deliberado: uma FK aqui só teria três comportamentos possíveis (`CASCADE` apaga o log, `RESTRICT` impede a exclusão, `SET NULL` destrói o dado da auditoria) e os três são piores que guardar o UUID cru ao lado do nome desnormalizado. O nome vai no snapshot **e** em coluna própria justamente para o log sobreviver ao paciente ser arquivado.

Imutabilidade por trigger, não por RLS:

```sql
CREATE FUNCTION fn_bloquear_alteracao_auditoria() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'agendamentos_auditoria é append-only';
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_append_only
  BEFORE UPDATE OR DELETE ON agendamentos_auditoria
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_alteracao_auditoria();
```

O trigger vale para service role, para o SQL Editor e para qualquer script — que é exatamente o ponto onde a RLS falharia.

**b) Uma função, quatro escopos, uma transação**

```
fn_excluir_atendimentos(
  p_ids              UUID[],      -- alvos resolvidos pela action conforme o escopo
  p_acao             TEXT,
  p_motivo_categoria TEXT,
  p_motivo_observacao TEXT,
  p_usuario_id       UUID,
  p_usuario_nome     TEXT
) RETURNS TABLE (excluidos INT, repostos INT)
```

Dentro de uma única transação:
1. Valida `p_motivo_categoria` contra a lista de motivos (tabela de catálogo — ver item **d**) e exige `p_motivo_observacao` não vazia quando a categoria for `outros`.
2. Valida `p_usuario_id` — nulo ou inexistente aborta.
3. **Bloqueia qualquer alvo com `status = 'Concluído'`** e aborta a operação inteira. Isso fecha o defeito do achado 1, no servidor, para os quatro escopos de uma vez.
4. `INSERT ... SELECT` no log, montando o snapshot com joins de paciente e profissional — **antes** do `DELETE`, com os dados ainda vivos.
5. `DELETE` dos atendimentos.
6. Limpeza da linha órfã em `agendamentos` quando a série esvazia.

Qualquer `RAISE` em qualquer passo desfaz tudo. C1 deixa de ser um cuidado de implementação e passa a ser propriedade do banco.

**c) Server Actions como casca**

As quatro assinaturas ganham um parâmetro de motivo e passam a delegar:

```ts
export async function deletarAgendamento(
  id: string,
  motivo: { categoria: string; observacao?: string }
): Promise<ResultadoExclusao> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  // usuario_nome resolvido do profile do ctx — nunca vem do cliente
  const { data, error } = await ctx.supabaseAdmin.rpc('fn_excluir_atendimentos', { ... })
  ...
}
```

A resolução de *quais* ids compõem cada escopo (a sessão, a série, o lote selecionado) permanece em TypeScript, onde já está e onde é testável. O que migra para o banco é a parte que precisa ser atômica.

A **reposição** da sessão pontual (achado 4) permanece na action, depois da RPC ter confirmado a exclusão — ela não é parte da auditoria, é regra de agenda. O log registra `acao = 'exclusao_sessao_recorrente'` e o snapshot carrega `numero_sessao`/`total_sessoes`, o que basta para o relatório distinguir reposição de perda.

**d) Catálogo de motivos em tabela**

`motivos_exclusao_agendamento (slug, label, exige_observacao, ordem, ativo)`, seeded com a lista do PRD. Em tabela e não em enum/constante porque a Suposição 2 tem confiança Média: a taxonomia vai errar na primeira versão, e corrigi-la deve ser um `UPDATE`, não um deploy. Mesma decisão já tomada em `status_disponibilidade_opcoes` no RFC 002.

**e) Modal de exclusão com motivo**

O fluxo atual do [`AgendamentoModal`](../../src/components/features/agenda/AgendamentoModal.tsx#L240) já é de dois passos (`confirmandoExclusao` → escopo). O motivo entra como o passo final, comum aos quatro escopos: lista de motivos em botões grandes (um toque), campo de observação que só aparece quando exigido, e confirmação desabilitada até haver categoria válida. Para série completa, aviso reforçado com a contagem de sessões afetadas.

Alvo de < 10s (C7) é atingível porque o caminho comum é **um toque a mais**: escolher o motivo já dispara o estado válido.

**f) Aba "Logs" em `/pacientes/[id]`**

Nova aba em [`PacienteTabsClient`](../../src/components/features/pacientes/PacienteTabsClient.tsx#L16), listando os logs daquele paciente em ordem cronológica: **quem excluiu · quando · escopo · motivo · dados da sessão apagada**. Gate por módulo, como as demais abas.

É a superfície principal de leitura, e por um motivo além da conveniência: a pergunta que a recepção faz na prática não é "quantas exclusões tivemos" — é *"o que aconteceu com este paciente?"*. Colocar o log ao lado do histórico de agendamentos responde essa pergunta no lugar onde ela nasce, sem exigir perfil de gestor.

**g) Painel gerencial em `/relatorios`**

Listagem global com os filtros do PRD (período, profissional, operador, motivo), restrita a gestor (`isGestorSistema`). Reusa a mesma tabela e os mesmos índices.

**Prós**
- Único desenho em que C1 e C2 são garantidos pelo banco, não pela disciplina de quem escreve a action.
- Fecha o defeito do histórico concluído para os quatro escopos com uma única checagem.
- Regra de exclusão em um lugar só: uma quinta action futura que não passe pela RPC não consegue apagar nada, porque o `DELETE` direto continua possível apenas via service role explícito — e isso vira item de revisão de código, não bug silencioso.
- Catálogo em tabela permite corrigir a taxonomia sem deploy.

**Contras**
- Lógica de negócio dentro do Postgres — mais difícil de testar com o `node --test` do projeto, e exige que a migration seja aplicada pelo SQL Editor do Studio ([acesso ao banco](../../docs/AUDITORIA_SUPABASE.md)).
- Mudança de assinatura nas quatro actions: qualquer chamador não migrado quebra em tempo de compilação (o que é o comportamento desejado, mas é trabalho).
- `SECURITY DEFINER` exige revisão de permissão cuidadosa — a função roda como owner.

**Custo:** ~6,5d (ver Custo Estimado).
**Avaliação:** atende C1–C7 e C9. Custo médio (C8).

---

### Opção 3 — Soft delete com `excluido_em` + motivo na própria linha

Em vez de apagar, marcar `atendimentos.excluido_em`, `excluido_por`, `motivo_*`, e filtrar todas as leituras.

**Prós**
- Atomicidade trivial: é um `UPDATE` só.
- Restauração possível, com FKs (mídias, prontuário, venda) intactas.
- Não precisa de snapshot — o dado original continua lá.

**Contras**
- **Contraria o "Fora do Escopo" do PRD**, que define hard delete + snapshot para a V1.
- Exige auditar e filtrar **toda** consulta a `atendimentos` no projeto — agenda, confirmações, relatórios, Tempo Fábril, KPIs. Uma leitura esquecida faz um atendimento excluído reaparecer num relatório, e é uma classe de bug que se manifesta meses depois.
- Não é append-only: a linha continua editável, então o "log" pode ser reescrito. Falha C2, a menos que se grave **também** a tabela de auditoria — e aí é a Opção 2 com trabalho extra.
- O snapshot da Opção 2 já entrega o essencial da reconstrução para a V1.

**Custo:** ~9d, dominado pela auditoria das leituras existentes.
**Avaliação:** falha **C2**. Fica registrada como evolução futura, se e quando "desfazer exclusão" virar requisito real (Suposição 3).

---

## Comparativo

| Critério | Peso | Op. 0 | Op. 1 | **Op. 2** | Op. 3 |
|----------|:----:|:-----:|:-----:|:---------:|:-----:|
| C1 Atomicidade | 5 | ❌ | ❌ compensação frágil | ✅ transação | ✅ |
| C2 Imutabilidade real | 5 | ❌ | ❌ só RLS, service role ignora | ✅ trigger | ❌ linha editável |
| C3 Autoria garantida | 5 | ❌ | ✅ | ✅ | ✅ |
| C4 Cobertura dos 4 escopos | 5 | ❌ | ⚠️ regra replicada 4× | ✅ ponto único | ⚠️ |
| C5 Bloqueio de Concluído no servidor | 4 | ❌ | ⚠️ 4 checagens | ✅ 1 checagem | ⚠️ |
| C6 Visibilidade | 4 | ❌ | ✅ | ✅ | ✅ |
| C7 Baixo atrito | 3 | ✅ | ✅ | ✅ | ✅ |
| C8 Custo | 3 | ✅ 0d | ✅ ~3d | ⚠️ ~6,5d | ❌ ~9d |
| C9 Reversibilidade | 2 | — | ✅ | ✅ | ✅ |

Opções 0, 1 e 3 falham pelo menos um Must-have e estão descartadas por isso. Entre as que restam, a Opção 2 é a única — e seu custo extra sobre a Opção 1 (~3,5d) compra precisamente as duas propriedades que o PRD lista em "NUNCA PODE".

---

## Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|:----------:|-----------|
| **`SECURITY DEFINER` com `search_path` mutável** é vetor clássico de escalação de privilégio | **Alta** | `SET search_path = public, pg_temp` na definição da função. Revisão explícita no PR |
| **Snapshot com dado de saúde** (procedimento, protocolo, observações) fica legível para todo autenticado | **Alta** | Suposição 4. RLS de SELECT espelhando a política de acesso a paciente; painel gerencial restrito a `isGestorSistema`. Definir antes do go-live, não depois |
| **Bloqueio de Concluído quebra fluxo existente** de quem usa "excluir série" para limpar duplicidade | Média | Suposição 6 — validar com a recepção **antes** (Ação 2). Se for prática real, prever categoria de motivo específica e escopo "somente pendentes" explícito no modal |
| **Migration exige SQL Editor do Studio** — não sai via REST | Média | Já é o procedimento padrão do projeto. Roteiro escrito junto da migration, como em [`ROTEIRO_APLICACAO_status_personalizados.md`](../../database/ROTEIRO_APLICACAO_status_personalizados.md) |
| **Trigger append-only bloqueia correção de log errado** — inclusive engano legítimo | Média | É o comportamento pedido pelo PRD. Correção se faz por log novo (`acao = 'retificacao'`), nunca por edição. Documentar isso na aba de Logs |
| **Reposição da sessão pontual roda fora da transação** — RPC confirma, reposição falha | Média | A falha deixa a série uma sessão menor, não corrompe log nem agenda. Já é o comportamento de hoje (o `insert` é best-effort, sem rollback). Logar o erro e sinalizar na resposta |
| **Assinatura das actions muda** — chamadores esquecidos | Baixa | TypeScript quebra em build. Os únicos chamadores hoje são `AgendamentoModal` e `ModalSelecaoExclusao` |
| **Alerta do build que derruba a VPS** (histórico do projeto) | Média | Build fora do horário de pico, como nas entregas anteriores |

---

## Custo Estimado

| Frente | Esforço | Observação |
|--------|:-------:|------------|
| Migration: tabela `agendamentos_auditoria` + índices + RLS + trigger append-only | 0,5d | Aditiva; não toca tabela existente |
| Migration: catálogo `motivos_exclusao_agendamento` + seed da lista do PRD | 0,5d | |
| `fn_excluir_atendimentos` — validação, bloqueio de Concluído, snapshot, delete, limpeza de série | 1,5d | Núcleo da entrega. Inclui `search_path` e testes dos 4 escopos |
| Refatorar as 4 Server Actions para casca fina sobre a RPC | 1d | Inclui resolver `usuario_nome` do profile |
| Modal: passo de motivo nos 4 escopos + aviso reforçado para série | 1,5d | `AgendamentoModal` e `ModalSelecaoExclusao` |
| Aba "Logs" em `/pacientes/[id]` | 1d | Estende `PacienteTabsClient`, padrão já estabelecido |
| Painel gerencial em `/relatorios` com os 4 filtros | 1d | |
| Validação em produção + roteiro de aplicação | 0,5d | |
| **Total** | **~7,5d** | Sem incluir o item opcional de exportação CSV do painel |

---

## Action Items

### Antes da decisão

| # | Ação | Owner | Resultado |
|---|------|-------|-----------|
| 1 | Medir volume de exclusões/semana — dimensiona paginação do painel e vira linha de base da métrica de 0% | Engenharia | Pendente. Não bloqueia a decisão |
| 2 | Confirmar com a recepção se "excluir série completa" é usado hoje para limpar cadastros com sessões concluídas (Suposição 6) | Coordenação | **Bloqueia**: define se o bloqueio é seco ou se precisa de escopo "somente pendentes" |
| 3 | Decidir a política de leitura do snapshot (Suposição 4 / risco de LGPD) | @Dr. Felipe + Gestão | **Bloqueia** a RLS da migration |

### Decisão

| # | Ação | Owner |
|---|------|-------|
| 4 | Aprovar este RFC (Opção 2) e responder as Questões em Aberto | @Dr. Felipe |

### Execução

| # | Ação | Owner | Bloqueia |
|---|------|-------|----------|
| 5 | Migrations: tabela de auditoria, catálogo de motivos, trigger append-only | Engenharia | 6, 7 |
| 6 | `fn_excluir_atendimentos` + testes dos 4 escopos, incluindo bloqueio de Concluído | Engenharia | 7 |
| 7 | Refatorar as 4 Server Actions para a RPC | Engenharia | 8, 9 |
| 8 | Modal de exclusão com motivo (4 escopos) | Engenharia | 10 |
| 9 | Aba "Logs" em `/pacientes/[id]` | Engenharia | 10 |
| 10 | Painel gerencial em `/relatorios` | Engenharia | 11 |
| 11 | Validação em produção + comunicação à recepção | Engenharia + Coordenação | — |

### Depois do go-live

| # | Ação | Owner | Prazo |
|---|------|-------|-------|
| 12 | Revisar distribuição de motivos — % de "Outros" decide se a taxonomia precisa de ajuste (Suposição 2) | Gestão | +30 dias |
| 13 | Reavaliar se "desfazer exclusão" virou demanda real (Suposição 3 → Opção 3) | Gestão | +90 dias |

---

## Questões em Aberto

1. **O bloqueio de exclusão de "Concluído" é absoluto, ou existe um caminho de exceção para gestor?** O PRD diz "bloqueio estrito". Se a recepção usa a exclusão de série para limpar duplicidades (Ação 2), o bloqueio seco cria um beco sem saída. Alternativa: escopo "excluir somente pendentes" explícito no modal, que é o comportamento que `buscarAtendimentosPendentesRecorrencia` já implementa para o lote.
2. **Quem enxerga a aba "Logs" no paciente?** Todo usuário com acesso ao paciente, ou só gestor? Depende da Ação 3. A recomendação é liberar para quem já vê o histórico — é a mesma classe de informação, e restringir esvazia o valor operacional da aba.
3. **O painel gerencial precisa de exportação CSV na V1?** Não está no PRD. Fora do escopo por padrão; +0,5d se entrar.
4. **Alterações de agendamento (reagendamento, troca de profissional) entram no mesmo log depois?** Fora do escopo desta V1, mas a coluna `acao` já é aberta o suficiente para receber `edicao_*` sem migration nova. Registrado para não desenhar uma tabela que precise ser refeita.

---

## Outcome

*(a preencher após a decisão)*

- **Decisão:**
- **Data:**
- **Decidido por:**
- **Justificativa:**
- **Divergências registradas:**
