# RFC: Migrar o MedGuia Hub do Supabase self-hosted para PostgreSQL nativo na VPS

| Campo | Valor |
|-------|-------|
| **Impact** | HIGH |
| **Status** | NOT STARTED |
| **Driver** | @raniery (dev full-stack / responsável técnico) |
| **Approver** | @raniery (decisão técnica), @gestao-clinica (aprovação da janela de manutenção) |
| **Contributors** | @devops-vps, @equipe-recepcao (validação funcional), @fisioterapeutas (homologação) |
| **Informed** | Toda a equipe da clínica (usuários do sistema) |
| **Due Date** | TBD — sugerido decidir até 2026-09-15 |
| **Resources** | [PRD 005](../prds/005-migracao-infra-supabase-para-postgres-vps.md), [AUDITORIA_SUPABASE.md](../AUDITORIA_SUPABASE.md), [HOMOLOGACAO_MIGRACAO_SUPABASE.md](../HOMOLOGACAO_MIGRACAO_SUPABASE.md), [PASSO_A_PASSO_HOMOLOGACAO_POSTGRES.md](../PASSO_A_PASSO_HOMOLOGACAO_POSTGRES.md) |
| **Created** | 2026-08-28 |
| **Last Updated** | 2026-08-28 (diagnóstico na VPS + direcionamento do Driver) |

> **Nota de revisão — 2026-08-28 (rev. 2).** Esta RFC foi atualizada após diagnóstico direto na VPS de produção (`docker stats`, `psql` no `supabase-db` e no `pg-master`) e após direcionamento do Driver.
>
> **Mudanças da rev. 1 (diagnóstico):** premissa nº 1 **derrubada** (RLS *é* a autorização real), premissa nº 3 **confirmada** (bcrypt padrão), **bloqueador não previsto** encontrado (PostgreSQL 15 vs 17).
>
> **Mudanças da rev. 2 (direcionamento):** o Driver informou que **o banco migrará para outra VPS no futuro**, o que introduz a *portabilidade* como critério de decisão e **rejeita a Opção 5**. A **Opção 1 fica decidida**. O upgrade PG 15→17 e os bancos das aplicações satélites saem do escopo desta RFC e serão tratados separadamente.

---

## Background

### Estado atual

O MedGuia Hub roda em Next.js 16 (App Router, React 19) e usa o ecossistema **Supabase self-hosted na própria VPS** como banco, auth e camada de acesso a dados. A mesma VPS opera um segundo PostgreSQL em container (`pg-master`), que atende outras aplicações.

**Auditoria de código** (`main`, 2026-08-28), medida diretamente e não herdada da auditoria de 2026-05-21:

| Métrica | Valor medido |
|---|---|
| Arquivos `.ts`/`.tsx` em `src/` | 327 |
| Arquivos que importam `@supabase/*` ou `@/lib/supabase/*` | **94** |
| Chamadas `.from('tabela')` | **434** |
| Tabelas distintas acessadas via `.from()` | 40 |
| Chamadas `.rpc(...)` | **17** (15 funções distintas) |
| Chamadas `supabase.auth.*` | **57** (41 são `auth.getUser()`) |
| Usos de `SUPABASE_SERVICE_ROLE_KEY` (bypass de RLS) | 14 arquivos |
| Canais Realtime (`.channel(...)`) | **9**, em 7 arquivos |
| Arquivos de teste automatizado | 6, todos de lógica pura — **nenhum de acesso a dados** |

**Correções ao PRD 005** — o PRD foi escrito sobre a auditoria de maio e três números estão defasados:

1. PRD diz "mais de 65 arquivos". Real: **94 arquivos**, **434 chamadas** `.from()`. Escopo ~45% maior.
2. PRD lista **7 RPCs**. Existem **15** — as adicionais vieram dos PRDs 003 e 004, posteriores ao dump.
3. PRD cita **2 pontos de Realtime**. Existem **9 canais em 7 arquivos**, incluindo `PainelTV` e painel de chamadas, que são telas de operação ao vivo com requisito de latência bem mais rígido que um Kanban.

### Diagnóstico da VPS (2026-08-28)

**Consumo de memória — a stack Supabase são 11 containers:**

| Container | RAM | Container | RAM |
|---|---|---|---|
| supabase-studio | 296,4 MiB | supabase-meta | 132,4 MiB |
| supabase-kong | 283,8 MiB | edge-functions | 99,5 MiB |
| supabase-storage | 234,5 MiB | imgproxy | 96,8 MiB |
| realtime | 214,2 MiB | supabase-rest | 46,0 MiB |
| supabase-pooler | 210,4 MiB | supabase-auth | 13,3 MiB |
| supabase-db | 172,5 MiB | | |
| | | **Total** | **~1,80 GiB** |

**Estado da máquina:** 7,8 GiB totais · 2,9 GiB em uso · **4,8 GiB disponíveis** · swap zerado.

Duas leituras, ambas verdadeiras:
- A stack Supabase é ~62% do consumo real da VPS. A meta de 40–60% de economia do PRD **se confirma** e é até conservadora.
- **Não há pressão de memória.** Com 4,8 GiB livres e swap zerado, nada na VPS está sofrendo por causa disso. O problema nº 1 do PRD ("sobrecarga de recursos") é, na prática, **desperdício — não dor operacional**.

**Volume de dados — a base é minúscula:**

| Tabela | Linhas | Tabela | Linhas |
|---|---|---|---|
| itens_venda | 344 | pacientes | **15** |
| contatos_base | 149 | jornada_mensal | 14 |
| atendimentos | 79 | configuracoes | 9 |
| atendimento_pastas_drive | 74 | vendas | 6 |
| notas_contato | 50 | demais | < 5 cada |
| agendamentos | 48 | | |
| confirmacoes_auditoria | 42 | **Total** | **~997 linhas** |
| prontuarios | 25 | **Usuários** (`auth.users`) | **32** |

**Versões e extensões:**
- `supabase-db`: **PostgreSQL 17.6** (`supabase/postgres:17.6.1.136`)
- `pg-master`: **PostgreSQL 15** (`postgres:15-alpine`) ← destino pretendido pelo PRD
- Extensões em uso: `pg_cron`, `pg_net`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`

### Problema

1. **Desperdício de recursos** — ~1,8 GiB de RAM em 11 containers, sem pressão de memória atual.
2. **Dois PostgreSQL na mesma VPS**, com backup e monitoramento fragmentados.
3. **Latência do intermediário HTTP** — toda leitura/escrita atravessa PostgREST; `auth.getUser()` é chamado **41 vezes** e cada chamada valida o JWT contra o GoTrue pela rede.
4. **Acoplamento crescente** — ~40 novas chamadas `.from()` por PRD entregue, na média dos últimos 4.

### Por que agora

- A migração **não começou**: `src/lib/db.ts` não existe; nenhum código de acesso nativo foi escrito.
- Backup e docs de homologação são de 2026-05-21 e já **não contêm** as funções dos PRDs 003/004.
- O custo da migração cresce monotonicamente a cada PRD entregue.

### O que acontece se não decidirmos

- O acoplamento segue crescendo e a migração fica mais cara.
- ~1,8 GiB seguem ocupados sem uso produtivo.
- **A dependência de RLS (achado abaixo) permanece invisível e não documentada** — o que é um risco por si só, independentemente da migração.

---

## Assumptions

| # | Premissa | Owner | Confiança | Status / Gatilho |
|---|---|---|---|---|
| 1 | ~~As políticas RLS não são a fonte real de autorização~~ | @raniery | — | ❌ **DERRUBADA em 2026-08-28.** Ver "Achado crítico" abaixo. A RLS **é** a autorização real de `atendimentos`. O escopo da Fase 2 cresceu |
| 2 | O volume de dados é pequeno, tornando dump/restore uma operação de minutos | @raniery | **Alta** | ✅ **CONFIRMADA.** 997 linhas. Restore leva segundos |
| 3 | Os hashes de `auth.users` são bcrypt legíveis pelo `bcryptjs` | @raniery | **Alta** | ✅ **CONFIRMADA.** Os 32 usuários usam `$2a$`, 60 chars — bcrypt padrão, formato único |
| 4 | Há janela de manutenção obtível fora do horário clínico | @gestao-clinica | **Alta** | Se a operação passar a ser 24/7 |
| 5 | O sistema roda em instância única (`migration-runner.ts` afirma "not suitable for multi-replica") | @raniery | **Alta** | Se houver escalonamento horizontal |
| 6 | A equipe tem capacidade para refatorar 94 arquivos sem congelar features clínicas | @raniery | **Baixa** | Ponto mais frágil do PRD e principal motivo da recomendação |
| 7 | **(nova)** O upgrade do `pg-master` de PG 15 → 17 será executado em escopo separado, antes da Fase 0 de dados | @raniery | **Média** | Se atrasar além da conclusão da Fase 2, o cutover fica bloqueado esperando infra |
| 8 | **(nova)** O banco do MedGuia **migrará para outra VPS no futuro**, portanto o destino deve ser PostgreSQL padrão e portável — sem extensões ou imagens proprietárias | @raniery | **Alta** | Declarado pelo Driver em 2026-08-28. Se a mudança de VPS for descartada, a Opção 5 volta a ser viável |
| 9 | **(nova)** Nada em produção depende de `supabase_vault`, `pg_net` ou `pg_cron` — extensões que não existem em `postgres:17` oficial | @raniery | **Baixa** | **Não verificado.** Se algo depender, a portabilidade exige reimplementar essa funcionalidade em código antes da mudança de VPS |

---

## 🔴 Achado crítico: a autorização vive no banco, não no código

**Evidência coletada em produção:**

```sql
-- Política ativa em atendimentos
Fisio_Own_Atendimentos | SELECT | {public} | (fisioterapeuta_id = auth.uid())

-- RLS ativo nas três tabelas sensíveis
 relname      | relrowsecurity | relforcerowsecurity
 pacientes    | t              | f
 atendimentos | t              | f
 profiles     | t              | f
```

**Comportamento confirmado pelo Driver:** um fisioterapeuta logado **vê apenas os atendimentos dele**.

**Evidência no código:** `src/lib/guard.ts` e `src/lib/permissoes.ts` **não filtram** por `fisioterapeuta_id`. Não há `.eq('fisioterapeuta_id', ...)` nas queries de atendimentos.

**Conclusão:** o que impede um fisioterapeuta de acessar prontuário de paciente alheio é **o PostgreSQL, não a aplicação**. O código nunca precisou implementar essa regra porque o banco já a aplicava via `auth.uid()`.

### Por que isso é o risco central do projeto

Quando a Fase 2 substituir `.from('atendimentos')` por `SELECT * FROM atendimentos` em um pool `pg` nativo, **`auth.uid()` deixa de existir naquela conexão**. A query retorna todas as linhas. Todo fisioterapeuta passa a enxergar atendimentos de todos os pacientes da clínica.

Sem erro. Sem exceção. Sem nada quebrando na tela — apenas mais linhas do que deveria.

É vazamento de dado clínico entre profissionais, do tipo que **passa por code review e por teste manual**, porque a interface funciona perfeitamente. Com 6 arquivos de teste, todos de lógica pura e nenhum de acesso a dados, não há rede de segurança automatizada para capturá-lo.

### Observação complementar

`relforcerowsecurity = f` confirma que os **14 arquivos que usam `SERVICE_ROLE_KEY` já ignoram RLS hoje**. Esses caminhos operam sem as proteções — o que é aceitável em contexto administrativo, mas convém auditar quais deles retornam dados a usuários finais.

### Mitigação obrigatória (nova Fase 1.5)

Extrair a autorização para o código **antes** de migrar qualquer módulo, com o Supabase ainda no ar:

1. Adicionar filtro explícito (`fisioterapeuta_id`, regra de gestor via `profiles.role`) nas queries de `atendimentos` e `pacientes`, com **RLS ainda ativo** por trás
2. Validar que o comportamento não muda — duas camadas aplicando a mesma regra (cinto e suspensório)
3. Só então migrar o módulo para SQL nativo, com a regra já garantida em código

Isso isola o momento perigoso — código virando a única defesa — de modo que ele aconteça **com o banco ainda protegendo**, em vez de simultaneamente à troca de driver.

---

## 🟠 Dependência externa: upgrade do `pg-master` de PostgreSQL 15 para 17

O PRD assume que o "PostgreSQL nativo da VPS" está pronto para receber a base. Não está:

| | Versão |
|---|---|
| Origem (`supabase-db`) | **PostgreSQL 17.6** |
| Destino (`pg-master`) | **PostgreSQL 15.18** (`postgres:15-alpine`) |

`pg_restore` de um dump gerado no PG 17 **não funciona** em um servidor PG 15. O `pg-master` precisa ser atualizado antes de receber o MedGuia.

**Estado do `pg-master` (diagnóstico 2026-08-28):**

| Banco | Owner | Conexões ativas |
|---|---|---|
| `evolution` | admin | **5** (WhatsApp — em uso) |
| `nps_ifot` | admin | 0 |
| `followup_agent` | **`followup_app`** (role própria) | 0 |
| `medguia_obs` | admin | 0 |
| `admin` (padrão) | admin | 1 |

- Superusuário: `admin` (não `postgres`)
- Armazenamento: **bind mount** em `/root/postgres/data` — não é volume nomeado
- Sem `docker-compose.yml` aparente; container provavelmente criado à mão

**Decisão do Driver (2026-08-28):** o upgrade e os dados das aplicações satélites (`evolution`, `nps_ifot`, `followup_agent`, `medguia_obs`) serão tratados **em momento e escopo separados**. Esta RFC não os cobre.

**Por que isso não bloqueia o início do trabalho:** as Fases 1, 1.5 e 2 rodam inteiramente contra o `supabase-db` atual e **não dependem do upgrade**. São 8+ semanas de trabalho disponíveis antes que o `pg-master` seja necessário.

| Fase | Depende do upgrade? |
|---|---|
| Fase 1 — auth nativa | ❌ Não |
| Fase 1.5 — extrair autorização da RLS | ❌ Não |
| Fase 2 — data layer por módulo | ❌ Não |
| Fase 0/3 — mover os dados para o destino | ✅ Sim |

**Pontos de atenção quando o upgrade acontecer** (fora do escopo, registrados para o outro chat):
- Major upgrade **não é troca de tag** — o formato em disco muda; o PG 17 recusa iniciar sobre um `PGDATA` de PG 15. Caminho: `pg_dumpall` → container novo com volume limpo → restore.
- O bind mount em `/root/postgres/data` permite backup físico trivial (`cp -a`) antes de qualquer coisa — rollback garantido.
- `followup_agent` tem role própria (`followup_app`): use `pg_dumpall` (que inclui roles), não `pg_dump` por banco.
- `evolution` está ativo com 5 conexões e atende o fluxo de confirmação da clínica — parada exige janela combinada.

---

## Decision Criteria

| Prioridade | Critério | Descrição | Peso |
|---|---|---|---|
| 1 | **Não regredir autorização** | Nenhum profissional pode passar a ver dado clínico que hoje não vê | **Must-have** |
| 2 | Integridade de dados clínicos | Zero perda/corrupção | **Must-have** |
| 3 | Continuidade operacional | Downtime ≤ 30 min, rollback ≤ 10 min | **Must-have** |
| 4 | Banco não exposto publicamente | 5432 apenas local/rede interna | **Must-have** |
| 5 | Preservação das senhas | Nenhuma redefinição em massa | **Alta** |
| 6 | Reversibilidade | Preferir caminhos reversíveis sem refazer trabalho | **Alta** |
| 7 | Risco de big-bang | Preferir incremental e verificável a virada única | **Alta** |
| 8 | **Portabilidade para outra VPS** | O banco migrará de VPS no futuro. O destino deve ser PostgreSQL padrão, sem imagem ou extensão proprietária, com schema e funções reprodutíveis por migration versionada | **Alta** |
| 9 | Não arrastar risco de terceiros | Evitar acoplar a migração ao upgrade de um banco que serve outras apps | **Alta** |
| 10 | Redução de consumo da VPS | Meta de 40–60% de RAM | **Média** |
| 11 | Latência das queries | Eliminar o hop HTTP e os 41 `auth.getUser()` | **Média** |
| 12 | Custo de oportunidade | Semanas aqui não entregam valor clínico | **Média** |
| 13 | Zero dependências `@supabase/*` | Higiene arquitetural | **Baixa** |

> O critério nº 1 foi **promovido a Must-have** e ao topo da lista após o diagnóstico. Na primeira versão desta RFC ele nem existia como critério isolado. Qualquer opção que não trate explicitamente a extração da RLS está **desqualificada**.
>
> O critério nº 8 foi **introduzido na rev. 2** a pedido do Driver e é o que rejeita a Opção 5: um banco que mudará de VPS não pode depender da imagem `supabase/postgres` nem de extensões que não existem em PostgreSQL oficial.
>
> O critério nº 13 segue sendo o de menor peso: remover o pacote do `package.json` é consequência, não objetivo.

---

## Relevant Data

**Quantitativo**
- 94 arquivos · 434 `.from()` · 17 `.rpc()` · 57 `auth.*` · 9 canais Realtime
- 41 `auth.getUser()` = 41 round-trips de rede ao GoTrue por render de página protegida
- Base: **997 linhas**, 32 usuários — dump/restore em segundos
- Supabase: **1,80 GiB** em 11 containers, de 2,9 GiB usados numa VPS de 7,8 GiB (4,8 GiB livres)
- RLS ativo em 3 tabelas; `relforcerowsecurity = f` em todas → `SERVICE_ROLE_KEY` ignora RLS
- Cobertura de testes de acesso a dados: **zero**

**Qualitativo**
- `HOMOLOGACAO_MIGRACAO_SUPABASE.md` já concluiu em maio que restaurar o backup valida o banco mas não a aplicação. Continua correto e fundamenta a Opção 1.
- Migração de banco (fácil, baixo risco) e migração de aplicação (difícil, alto risco) são **problemas separáveis**. O PRD 005 os trata como um evento único.
- O risco real do projeto **não é perda de dados** (997 linhas, dump prévio, recuperação trivial) — é **regressão silenciosa de autorização**.

---

## Options Considered

### Opção 1: Migração faseada — banco, auth, autorização, data layer por módulo ⭐ (Recomendada)

**Descrição**

Separa a migração em fases independentes, cada uma com valor e rollback próprios. O Supabase permanece de pé até a aplicação não precisar mais dele; o desligamento é a *última* etapa, não a virada.

**Como funciona**

1. **Fase 0 — Preparação (1 semana).** Regerar auditoria e dump (os atuais estão 3 meses defasados). Criar `medhub_teste`, restaurar, validar extensões e contagens. Criar `src/lib/db.ts` com pool `pg` e `DATABASE_URL`. **Resolver o bloqueador PG 15→17** (ou adotar a Opção 5).
2. **Fase 1 — Auth nativa (1–2 semanas).** Migrar `auth.users` → tabela local preservando IDs e os hashes `$2a$`. Sessão em cookie assinado `HttpOnly`+`Secure`+`SameSite=Lax`. Substituir middleware e `guard.ts`. Elimina os **41 `auth.getUser()`** — maior ganho isolado de latência — e desliga o GoTrue.
3. **Fase 1.5 — Extração da autorização (1 semana) — OBRIGATÓRIA.** Reimplementar em código as regras hoje aplicadas por RLS (`Fisio_Own_Atendimentos`, `Gestor_All_*`, `Medico_Own_Pacientes`), **com RLS ainda ativo**. Ver "Achado crítico". Sem esta fase, a Fase 2 introduz vazamento de dado clínico.
4. **Fase 2 — Data layer por módulo (4–8 semanas).** `.from()` → SQL parametrizado, **um módulo por PR** (pacientes → agenda → prontuários → vendas → contatos), com o restante ainda no Supabase apontando para o **mesmo banco físico**. As 15 RPCs viram `SELECT * FROM fn_x($1,...)`.
5. **Fase 3 — Realtime e desligamento (1–2 semanas).** Substituir os 9 canais: SSE para `PainelTV` e painel de chamadas (latência real); polling/SWR para Kanban e disponibilidade. Remover `@supabase/*`, desligar containers, ativar `pg_dump` diário com rotação de 30 dias.

**Ponto-chave:** durante as Fases 1–2, o Supabase e o pool nativo apontam para **a mesma instância PostgreSQL**. O PostgREST é apenas mais um cliente do banco. Não há sincronização, dupla escrita ou janela de inconsistência.

**Prós**
- Cada fase é entregável, testável e reversível isoladamente (reverter um PR).
- Downtime real: segundos (base de 997 linhas).
- A Fase 1.5 isola o risco de autorização, tratando-o com o banco ainda protegendo.
- Permite entregar features clínicas em paralelo.
- Ganho de latência chega na semana ~2, não no fim.

**Contras**
- Convive temporariamente com dois estilos de acesso a dados.
- Prazo total maior que um big-bang bem-sucedido.
- Economia de RAM só se realiza no fim.
- Depende de resolver o upgrade PG 15→17 (ou combinar com a Opção 5).

**Custo estimado: LARGE** · Esforço: 8–14 semanas com features em paralelo · Financeiro: R$ 0 · Risco: **BAIXO**

---

### Opção 2: Big-bang conforme o PRD 005

**Descrição**

Refatora os 94 arquivos, homologa em `medhub_teste`, e vira em uma janela única: troca de env, deploy e desligamento do Supabase.

**Prós**
- Estado final limpo, sem convivência de dois estilos.
- Economia de RAM de uma vez.
- É o plano já escrito no PRD.

**Contras**
- **Um branch de 94 arquivos contra uma `main` que recebe features** produz conflito contínuo. Foram 4 PRDs recentes; a `main` não vai congelar.
- Homologação "100% dos módulos" é manual: 40 tabelas, 15 RPCs, ~20 telas, **zero testes de acesso a dados**.
- **O achado de RLS torna esta opção substancialmente mais perigosa**: a extração da autorização aconteceria junto com a troca de driver, no mesmo branch, validada pelo mesmo teste manual. É a combinação exata que produz vazamento silencioso.
- Rollback reverte a infra, mas não devolve as semanas — e um bug de autorização descoberto depois do cutover não tem rollback trivial, porque dados já foram gravados sob a regra errada.

**Custo estimado: LARGE** · Esforço: 6–10 semanas, provável freeze de features · Risco: **ALTO**

---

### Opção 3: Migrar só o banco, mantendo o Supabase apontado para o Postgres nativo

**Descrição**

Aponta os containers Supabase para o `pg-master` e desliga apenas o `supabase-db`. Zero mudança de código.

**Prós**
- Executável em uma tarde, risco baixo, totalmente reversível.
- Elimina a duplicidade de instâncias e unifica backup.

**Contras**
- Economiza apenas **172,5 MiB** (o `supabase-db`) de 1,80 GiB — ~10% da meta.
- Não elimina o hop HTTP nem os 41 `auth.getUser()`.
- Não reduz acoplamento.
- **Exige o upgrade PG 15→17**, arrastando risco para `nps-ifot-api` e `evolution`.

**Custo estimado: SMALL** · Esforço: 1–2 dias (+ upgrade do PG) · Risco: **BAIXO** (MÉDIO com o upgrade)

---

### Opção 4: Não fazer nada (status quo)

**Prós**
- Zero risco e zero custo de oportunidade.
- **A VPS tem 4,8 GiB livres e swap zerado** — nada está sofrendo hoje.
- 100% do tempo de engenharia vai para valor clínico.

**Contras**
- Acoplamento cresce ~40 chamadas `.from()` por PRD.
- ~1,8 GiB seguem ocupados improdutivamente.
- Backup e monitoramento seguem fragmentados.
- **A dependência de RLS permanece invisível e não documentada** — risco que existe independentemente de migrar.

**Custo estimado:** SMALL agora / **LARGE** no longo prazo · Risco: **MÉDIO (crescente)**

---

### Opção 5: Adotar o `supabase-db` como banco definitivo e desligar os outros 10 containers ❌ (Rejeitada)

> **Rejeitada em 2026-08-28 pelo Driver.** O banco migrará para outra VPS no futuro (premissa nº 8). Manter a imagem `supabase/postgres` como destino definitivo cria dependência de fornecedor exatamente onde a portabilidade é requisito — falha no critério nº 8 (peso Alto). Registrada abaixo para preservar o histórico da decisão.

**Descrição**

Opção revelada pelo diagnóstico. Em vez de migrar os dados para o `pg-master`, **mantém o `supabase-db` (PostgreSQL 17.6) como o banco definitivo do MedGuia** e desliga apenas os demais containers Supabase. A aplicação passa a se conectar direto nele via pool `pg`.

**Como funciona**
1. Fases 1, 1.5, 2 e 3 da Opção 1, idênticas
2. `DATABASE_URL` aponta para o `supabase-db` — que deixa de ser "o banco do Supabase" e vira "o PostgreSQL do MedGuia"
3. Desligar Kong, PostgREST, GoTrue, Realtime, Studio, Meta, Storage, imgproxy, edge-functions, pooler
4. **Nenhuma migração de dados. Nenhum dump/restore. Nenhum upgrade de versão.**

**Prós**
- **Economiza ~1,63 GiB de 1,80 GiB (91% da meta)** sem mover um único byte de dado.
- **Elimina o bloqueador PG 15→17 por completo** — o banco já é 17.6.
- **Remove o maior risco residual**: sem migração de dados, o Must-have nº 2 (integridade) é satisfeito trivialmente.
- Não arrasta risco para `nps-ifot-api` e `evolution` (critério nº 8).
- Downtime de cutover próximo de zero — é só deploy.
- A imagem `supabase/postgres` é PostgreSQL padrão com extensões; nada impede usá-la como banco comum.

**Contras**
- **Não elimina a duplicidade de bancos na VPS** (problema nº 2 do PRD) — seguem dois PostgreSQL, embora com donos e propósitos distintos.
- Mantém dependência da imagem `supabase/postgres` para atualizações (mitigável: migrar para `postgres:17` oficial depois, com calma, fora da janela crítica).
- Extensões `supabase_vault`, `pg_net` e `pg_cron` ficam presentes sem uso; convém auditar se algo depende delas.
- Contraria a letra do PRD, que especifica consolidação no PostgreSQL nativo.

**Custo estimado: MEDIUM** · Esforço: 7–13 semanas (Opção 1 menos a Fase 0 de dados) · Risco: **MUITO BAIXO**

---

## Options Comparison

| Critério | **Op. 1 (Faseada)** ⭐ | Op. 2 (Big-bang) | Op. 3 (Só banco) | Op. 4 (Nada) | Op. 5 (supabase-db) ❌ |
|---|---|---|---|---|---|
| **Não regredir autorização** *(Must)* | ✅ Fase 1.5 isolada | ❌ Junto da troca de driver | ✅ N/A | ✅ N/A | ✅ Fase 1.5 isolada |
| Integridade de dados *(Must)* | ✅ Alta (997 linhas) | ⚠️ Janela única | ✅ Alta | ✅ N/A | ✅ Trivial — não move dados |
| Continuidade operacional *(Must)* | ✅ Segundos | ⚠️ Até 30 min | ✅ Minutos | ✅ Nenhum | ✅ Só deploy |
| Banco não exposto *(Must)* | ✅ | ✅ | ✅ | ⚠️ Como está | ✅ |
| Preservação de senhas | ✅ bcrypt confirmado | ⚠️ Testado só no fim | ✅ Intocadas | ✅ N/A | ✅ bcrypt confirmado |
| Reversibilidade | ✅ Por PR | ❌ Tudo ou nada | ✅ Total | ✅ N/A | ✅ Por PR |
| Risco de big-bang | ✅ Eliminado | ❌ É o risco central | ✅ N/A | ✅ N/A | ✅ Eliminado |
| **Portabilidade p/ outra VPS** | ✅ **PostgreSQL padrão** | ✅ PostgreSQL padrão | ⚠️ Parcial | ❌ Preso ao Supabase | ❌ **Preso à imagem Supabase** |
| Não arrastar risco de terceiros | ⚠️ Exige PG 15→17 | ⚠️ Exige PG 15→17 | ❌ Exige PG 15→17 | ✅ N/A | ✅ Não toca no pg-master |
| Economia de RAM | ✅ ~1,80 GiB | ✅ ~1,80 GiB | ❌ 172 MiB (10%) | ❌ Nenhuma | ✅ ~1,63 GiB (91%) |
| Latência | ✅ Semana ~2 | ✅ No fim | ❌ Nenhum | ❌ Nenhuma | ✅ Semana ~2 |
| Custo de oportunidade | ⚠️ 8–14 sem. | ❌ 6–10 sem. + freeze | ✅ 1–2 dias | ✅ Zero | ⚠️ 7–13 sem. |
| Fim da duplicidade de bancos | ✅ | ✅ | ✅ | ❌ | ❌ Mantém dois |
| Zero deps `@supabase/*` | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Risco global** | **BAIXO** | **ALTO** | **BAIXO/MÉDIO** | **MÉDIO** | ~~MUITO BAIXO~~ (rejeitada) |

### Recomendação: **Opção 1 — migração faseada**

A rev. 1 desta RFC recomendava a Opção 5, por entregar 91% da economia de RAM sem mover dados nem exigir upgrade de PostgreSQL. **O direcionamento do Driver em 2026-08-28 tornou essa recomendação inválida:** se o banco migrará para outra VPS, adotar a imagem `supabase/postgres` como destino definitivo apenas adia o desacoplamento, criando dependência de fornecedor exatamente onde a portabilidade é requisito. O critério nº 8 (peso Alto) rejeita a Opção 5.

A **Opção 1** é a única que satisfaz os quatro Must-haves e entrega portabilidade real: PostgreSQL padrão, sem extensões proprietárias, schema e funções reprodutíveis por migration versionada — o que torna a futura mudança de VPS um `pg_dump`/`pg_restore` comum em vez de um segundo projeto de migração.

**Consequências que a portabilidade impõe ao plano:**
1. O destino deve ser **`postgres:17` oficial**, não `supabase/postgres:17`.
2. As **15 RPCs e o schema** precisam virar arquivos `.sql` versionados no repositório. Hoje existem apenas dentro do banco — o que numa mudança de VPS significa depender de um dump que pode falhar.
3. As extensões `supabase_vault`, `pg_net` e `pg_cron` **não existem** em PostgreSQL oficial e precisam ser auditadas antes do desligamento (premissa nº 9, ainda não verificada).

**A Fase 1.5 é obrigatória em qualquer cenário.** O critério nº 1 é Must-have e desqualifica a Opção 2.

**O upgrade PG 15→17 não bloqueia o início.** As Fases 1, 1.5 e 2 rodam contra o `supabase-db` atual. O trabalho começa pela Fase 1.5, que é onde está o risco real.

---

## Action Items

> **Ordem de execução.** O trabalho começa pela **Fase 1.5** (extração da autorização), não pela infraestrutura. É onde está o risco real, e não depende do upgrade PG 15→17 nem de qualquer mudança na VPS.

| Ação | Owner | Prazo | Status |
|---|---|---|---|
| ~~Decidir entre Opção 5 e Opção 1~~ | @raniery | — | ✅ **DECIDIDO 2026-08-28: Opção 1** (portabilidade futura) |
| **Auditar os 14 arquivos com `SERVICE_ROLE_KEY`** e verificar quais retornam dados a usuários finais ignorando RLS | @raniery | Imediato | NOT STARTED |
| **Verificar a premissa nº 9** — se algo depende de `supabase_vault`, `pg_net` ou `pg_cron` (não existem em `postgres:17` oficial) | @raniery | Fase 0 | NOT STARTED |
| **Versionar as 15 RPCs e o schema como migrations `.sql`** no repositório — pré-requisito de portabilidade | @raniery | Fase 0 | NOT STARTED |
| **Documentar as regras de RLS como especificação de autorização** (hoje só existem no banco) | @raniery | Fase 0 | NOT STARTED |
| Regerar auditoria (`npm run audit:supabase`) e dump — atuais de 2026-05-21, sem as funções dos PRDs 003/004 | @raniery | Fase 0 | NOT STARTED |
| Criar `src/lib/db.ts` (pool + transações) | @raniery | Fase 0 | NOT STARTED |
| Criar `medhub_teste` para homologação dos PRs | @devops-vps | Fase 0 | NOT STARTED |
| **Upgrade do `pg-master` PG 15 → 17** — escopo separado, ver "Dependência externa". Necessário só na Fase 0 de dados | @raniery | Antes do cutover | **FORA DESTA RFC** |
| Executar Fase 1 (auth nativa, sessão em cookie, middleware) | @raniery | Fase 1 | NOT STARTED |
| **Executar Fase 1.5 — extrair autorização para código com RLS ainda ativo** | @raniery | Fase 1.5 | NOT STARTED |
| Escrever testes automatizados de autorização (fisio vê só os dele; gestor vê tudo) — **não existe hoje** | @raniery | Fase 1.5 | NOT STARTED |
| Executar Fase 2, um PR por módulo | @raniery | Fase 2 | NOT STARTED |
| Substituir os 9 canais Realtime (SSE para PainelTV/chamadas; polling para o resto) | @raniery | Fase 3 | NOT STARTED |
| Auditar dependências de `supabase_vault`, `pg_net`, `pg_cron` antes do desligamento | @raniery | Fase 3 | NOT STARTED |
| Script `pg_dump` diário com rotação de 30 dias e log de sucesso/falha | @devops-vps | Fase 3 | NOT STARTED |
| Confirmar que 5432 só aceita conexões locais (UFW/rede Docker) | @devops-vps | Fase 3 | NOT STARTED |
| Remover `@supabase/*` do `package.json` e desligar os 10 containers | @raniery | Fase 3 | NOT STARTED |
| Criar TDD de implementação da opção aprovada | @raniery | Após aprovação | NOT STARTED |

---

## Outcome

**Decisão:** **Opção 1 — migração faseada**, com direção arquitetural confirmada (sair do Supabase). Pendente apenas a aprovação formal da janela de manutenção pela gestão clínica.

**Data da decisão:** 2026-08-28 (direção técnica)

**Decidido por:** @raniery

**Racional:**

O diagnóstico em produção descartou as duas alternativas de menor esforço. A Opção 3 economiza apenas 10% da RAM e não reduz acoplamento. A Opção 5, recomendada na rev. 1 por entregar 91% da economia sem mover dados, foi rejeitada quando o Driver informou que **o banco migrará para outra VPS no futuro**: adotar a imagem `supabase/postgres` como destino definitivo apenas adiaria o desacoplamento.

A Opção 2 (big-bang, conforme o PRD) foi descartada por falhar no Must-have nº 1: nela, a extração da autorização hoje aplicada por RLS aconteceria no mesmo branch da troca de driver, validada por teste manual, sem nenhum teste automatizado de acesso a dados.

**Fatores-chave:**
- **Portabilidade** — o destino precisa ser PostgreSQL padrão, sem imagem ou extensão proprietária, para que a futura mudança de VPS seja um `pg_dump`/`pg_restore` comum
- **A autorização vive no banco, não no código** — descoberto no diagnóstico; exige a Fase 1.5 antes de qualquer migração de data layer
- **Reversibilidade por PR** — com 94 arquivos, 434 chamadas e zero testes de acesso a dados, um branch longo é o cenário de falha mais provável
- **Base minúscula (997 linhas)** — a migração de dados é o menor dos riscos; o risco real é regressão silenciosa de autorização

**Condições / ressalvas:**
- A **Fase 1.5 é bloqueante** para a Fase 2. Nenhum módulo com dado clínico migra antes de a autorização estar em código e coberta por teste
- O **upgrade PG 15→17** é dependência externa, tratada em escopo separado. Necessário apenas na Fase 0 de dados — não bloqueia as Fases 1, 1.5 e 2
- A **premissa nº 9** (dependências de `supabase_vault`/`pg_net`/`pg_cron`) segue **não verificada** e pode ampliar o escopo da portabilidade
- A janela de manutenção do cutover ainda depende de aprovação de @gestao-clinica

**Follow-up:**
- [ ] Criar TDD de implementação da Fase 1.5 (primeira a executar)
- [ ] Auditar os 14 arquivos com `SERVICE_ROLE_KEY`
- [ ] Atualizar `AUDITORIA_SUPABASE.md` e `HOMOLOGACAO_MIGRACAO_SUPABASE.md` — ambos partem da premissa, agora superada, de que o Supabase self-hosted seria mantido para homologação
- [ ] Comunicar a equipe clínica sobre a janela de manutenção
- [ ] Retrospectiva 1 mês após o desligamento do Supabase

---

### Fora do escopo desta RFC

- **Upgrade do `pg-master` PG 15 → 17** e migração dos bancos satélites (`evolution`, `nps_ifot`, `followup_agent`, `medguia_obs`) — tratados separadamente
