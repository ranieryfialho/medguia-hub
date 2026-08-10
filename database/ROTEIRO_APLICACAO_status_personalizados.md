# Roteiro de aplicação — Ciclo de vida dos status personalizados

Aplicação em produção (`supabase.medguia.cloud`) das 4 migrations da feature
`status-personalizados-ciclo-vida` — [RFC 002](../docs/rfcs/002-ciclo-de-vida-dos-status-personalizados.md).

**Tudo pelo SQL Editor do Studio.** Rode um bloco por vez e confira o resultado
antes de seguir. As migrations são independentes entre si, mas a ordem abaixo
reduz o tempo em que o sistema fica em estado misto.

> **Ordem geral: migrations primeiro, deploy do app depois.** O código novo grava
> e lê colunas que só existem após a migration. O caminho inverso quebra a troca
> de status.

---

## 0. Antes de começar

### 0.1 Janela

Escolha um horário **fora do expediente** dos fisioterapeutas. Dois motivos:

- O passo 1 remove o gatilho legado; concluir atendimento durante a troca tem
  comportamento indefinido por alguns segundos.
- O passo 3 destrava quem está com status personalizado aberto há mais de 1h — se
  alguém estiver em reunião de verdade, o bloco será fechado no teto de 1h.

### 0.2 Backup

Confirme que há backup recente do Postgres antes de qualquer `ALTER TABLE`.

### 0.3 Pré-checagens — **bloqueiam a aplicação se falharem**

> **Executadas em 10/08 — resultado registrado abaixo de cada uma.**

```sql
-- A) A coluna 'origem' existe?
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'status_disponibilidade' AND column_name = 'origem';
```

> **Resultado: nenhuma linha — a coluna NÃO existe em produção.** Era o cenário
> que bloqueava o passo 3. A migration passou a criá-la com `ADD COLUMN IF NOT EXISTS` antes da constraint. É também a explicação do caminho defensivo em
> `setStatusDisponibilidade`, que reescreve o upsert sem `origem` quando o banco
> reclama que a coluna não existe.

```sql
-- B) Existe algum valor de 'origem' fora do domínio novo?
SELECT DISTINCT origem, COUNT(*)
FROM status_disponibilidade
WHERE origem IS NOT NULL
  AND origem NOT IN ('manual', 'automatico', 'fallback')
GROUP BY origem;
```

> **Resultado: erro `column "origem" does not exist`** — consequência de (A), não
> um problema à parte. Depois de aplicar o passo 3, a coluna existirá vazia e
> esta consulta volta 0 linhas. Não precisa ser rodada de novo antes.

```sql
-- C) Retrato do que existe agora — guarde a saída para comparar depois.
SELECT
  (SELECT COUNT(*) FROM status_disponibilidade
    WHERE status NOT IN ('disponivel','ausente','ocupado'))        AS em_status_personalizado,
  (SELECT COUNT(*) FROM status_disponibilidade
    WHERE status NOT IN ('disponivel','ausente','ocupado')
      AND atualizado_em < NOW() - INTERVAL '1 hour')               AS travados_ha_mais_de_1h,
  (SELECT COUNT(*) FROM historico_status_disponibilidade
    WHERE fim IS NULL)                                             AS blocos_abertos,
  (SELECT COUNT(*) FROM profiles WHERE ativo IS NULL)              AS perfis_com_ativo_nulo,
  (SELECT COUNT(*) FROM status_disponibilidade WHERE status = 'ocupado') AS travados_em_ocupado;
```

**Resultado de C em 10/08:**

| Medida                      | Valor |
| --------------------------- | ----: |
| `em_status_personalizado` |     3 |
| `travados_ha_mais_de_1h`  |     3 |
| `blocos_abertos`          |     0 |
| `perfis_com_ativo_nulo`   |     0 |
| `travados_em_ocupado`     |     2 |

Duas leituras importantes:

- **3 travados com 0 blocos abertos** é o caso órfão puro. Sem a rede de segurança
  de AC-019, o passo 3 destravaria ninguém — o CTE não teria o que retornar. É a
  confirmação de que aquele achado era real e carregava a feature.
- **0 perfis com `ativo` nulo** torna o `SET NOT NULL` do passo 4 seguro, sem
  depender da normalização que a própria migration faz antes.

---

## 1. Remover o escritor legado

**Aplicar:** copie o conteúdo inteiro de
[`status_operacionais_contrato_migration.sql`](status_operacionais_contrato_migration.sql)
no SQL Editor e execute.

Primeiro porque elimina o gatilho que pode sobrescrever status durante os passos
seguintes. Também renomeia "Ocupado" para "Em atendimento" e o reclassifica como
status de sistema.

### Conferência

```sql
-- Gatilho e funções sumiram? Esperado: 0 linhas nas duas consultas.
SELECT tgname FROM pg_trigger
WHERE tgname = 'trg_concluir_atendimento' AND NOT tgisinternal;

SELECT proname FROM pg_proc
WHERE proname IN ('fn_trigger_concluir_atendimento', 'fn_atualizar_status_em_atendimento');

-- Catálogo: 'ocupado' agora é de sistema, com o identificador intacto.
SELECT slug, label, label_curto, sistema FROM status_disponibilidade_opcoes WHERE slug = 'ocupado';
-- Esperado: ocupado | Em atendimento | atendimento | true

-- Resíduos limpos. Esperado: 0.
SELECT COUNT(*) FROM status_disponibilidade WHERE status = 'ocupado';
```

**Se algo falhar aqui, pare.** Os passos seguintes assumem que não há mais
escritor legado.

---

## 2. Observação com lastro no histórico

**Aplicar:** copie o conteúdo inteiro de
[`status_personalizados_observacao_migration.sql`](status_personalizados_observacao_migration.sql)
no SQL Editor e execute.

Antes do passo 3, porque o gatilho de log recriado aqui é o que grava a
observação — e o passo 3 dispara esse gatilho no destravamento.

### Conferência

```sql
-- As três colunas existem?
SELECT table_name, column_name FROM information_schema.columns
WHERE (table_name = 'status_disponibilidade'            AND column_name = 'observacao')
   OR (table_name = 'historico_status_disponibilidade'  AND column_name = 'observacao')
   OR (table_name = 'status_disponibilidade_opcoes'     AND column_name = 'observacao_obrigatoria');
-- Esperado: 3 linhas

-- A função de log passou a copiar a observação?
SELECT prosrc LIKE '%NEW.observacao%' AS copia_observacao
FROM pg_proc WHERE proname = 'fn_log_mudanca_status_disponibilidade';
-- Esperado: true
```

---

## 3. Teto de 1 hora e devolução para Disponível

**Aplicar:** copie o conteúdo inteiro de
[`status_personalizados_fallback_1h_migration.sql`](status_personalizados_fallback_1h_migration.sql)
no SQL Editor e execute.

**É o passo que muda comportamento visível.** Reagenda o job, cria o domínio de
`origem` e destrava quem já está preso — incluindo os 3 profissionais
identificados em 10/08, um deles há 2 dias e 20 horas.

### Conferência

```sql
-- O job tem o teto de 1h e os dois comandos, na ordem certa?
SELECT jobname, schedule, active,
       command LIKE '%1 hour%'                 AS teto_1h,
       command NOT LIKE '%2 hours%'            AS sem_teto_antigo,
       position('historico_status' in command)
         < position('UPDATE status_disponibilidade sd' in command) AS ordem_correta
FROM cron.job WHERE jobname = 'fechar-status-esquecidos';
-- Esperado: */10 * * * * | true | true | true | true

-- Ninguém mais travado. Esperado: 0.
SELECT COUNT(*) FROM status_disponibilidade
WHERE status NOT IN ('disponivel','ausente','ocupado')
  AND atualizado_em < NOW() - INTERVAL '1 hour';

-- Nenhum bloco ficou aberto além do teto. Esperado: 0.
SELECT COUNT(*) FROM historico_status_disponibilidade
WHERE fim IS NULL AND inicio < NOW() - INTERVAL '1 hour';

-- Nenhum bloco foi inflado pelo destravamento: durações acima de 1h fechadas agora.
-- Esperado: 0. Se vier > 0, o gatilho fechou com a duração inteira — investigue.
SELECT COUNT(*) FROM historico_status_disponibilidade
WHERE duracao_minutos > 61
  AND fim > NOW() - INTERVAL '5 minutes';
```

---

## 4. Profissional inativo

**Aplicar:** copie o conteúdo inteiro de
[`profissional_inativo_migration.sql`](profissional_inativo_migration.sql)
no SQL Editor e execute.

### Conferência

```sql
-- Coluna nova, ativo obrigatório, gatilho no lugar.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='inativado_em')                       AS tem_coluna,
  (SELECT is_nullable FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='ativo')                              AS ativo_nullable,
  (SELECT COUNT(*) FROM pg_trigger
    WHERE tgname='trg_profiles_inativar' AND NOT tgisinternal)                        AS tem_gatilho;
-- Esperado: 1 | NO | 1
```

---

## 5. Deploy do app

Só depois dos quatro passos acima. A branch é `spec/status-personalizados-ciclo-vida`.

Confira antes do deploy: `npx tsc --noEmit` e `node --test` devem sair limpos —
50 testes passando na última execução.

---

## 6. Validação de comportamento — o que os testes não provaram

As migrations foram verificadas por asserção sobre o **texto** do SQL. Nada disso
prova o comportamento do Postgres. Estes seis testes só podem ser feitos aqui.

| # | O que testar                             | Como                                                                      | Esperado                                                                                 |
| - | ---------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1 | Observação é gravada nas duas tabelas | Trocar para um status com observação pelo widget                        | Texto em`status_disponibilidade.observacao` e no bloco novo do histórico              |
| 2 | Observação obrigatória bloqueia       | Marcar um status como obrigatório e tentar trocar sem texto              | Recusa com mensagem, mesmo forçando pela API                                            |
| 3 | Observação sobrevive à troca          | Entrar em Reunião com texto A, depois em Hora administrativa com texto B | Dois blocos no histórico, cada um com o seu texto                                       |
| 4 | O teto de 1h fecha e devolve             | Entrar num status e esperar ~70 min                                       | Bloco com ~60 min, status de volta em Disponível,`origem = 'fallback'`                |
| 5 | "Em atendimento" sumiu da escolha        | Abrir o widget                                                            | Não aparece na lista "Meu status"                                                       |
| 6 | Desligar limpa o estado ao vivo          | Inativar um perfil de teste                                               | `inativado_em` preenchido, bloco fechado, linha removida de `status_disponibilidade` |

O teste **4 é o mais importante** — é o comportamento inteiro da feature, e o
único que depende do `pg_cron` executar de fato. Faça com uma conta de teste.

### Acompanhamento nas primeiras 48h

```sql
-- O cron está rodando e fechando? Rode no dia seguinte.
SELECT jrd.status, jrd.return_message, jrd.start_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'fechar-status-esquecidos'
ORDER BY jrd.start_time DESC LIMIT 20;

-- Quantos blocos expiraram por fallback vs. foram encerrados pela pessoa?
-- Este é o número que decide se a Opção 3 do RFC volta à mesa (Ação 13).
SELECT
  COUNT(*) FILTER (WHERE origem = 'fallback') AS expirados_automaticamente,
  COUNT(*) FILTER (WHERE origem = 'manual')   AS encerrados_pela_pessoa
FROM status_disponibilidade
WHERE atualizado_em > NOW() - INTERVAL '48 hours';
```

---

## 7. Como voltar atrás

Cada passo é reversível de forma independente.

| Passo | Reversão                                                                                                                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Recriar gatilho e funções a partir de[`status_disponibilidade_automatico.sql`](status_disponibilidade_automatico.sql); `UPDATE status_disponibilidade_opcoes SET label='Ocupado', label_curto='ocupado', sistema=false WHERE slug='ocupado'`                                          |
| 2     | Restaurar a função de log de[`historico_status_disponibilidade_migration.sql`](historico_status_disponibilidade_migration.sql). **Não remova as colunas** — elas são aditivas e podem já ter dados                                                                            |
| 3     | Reagendar o job com o teto de 2h a partir de[`ajustar_frequencia_cron_fallback.sql`](ajustar_frequencia_cron_fallback.sql); `ALTER TABLE status_disponibilidade DROP CONSTRAINT status_disponibilidade_origem_check`. O destravamento já feito **não** se desfaz — nem deveria |
| 4     | `DROP TRIGGER trg_profiles_inativar ON profiles; DROP FUNCTION fn_inativar_profissional(); ALTER TABLE profiles ALTER COLUMN ativo DROP NOT NULL`                                                                                                                                        |

Se precisar reverter o app sem reverter o banco: as colunas novas são aditivas e
o código antigo as ignora. O único efeito é que a observação deixa de ser gravada.

---

## 8. Comunicar a equipe — antes do go-live

Combinado no RFC (Ação 12). Três pontos, em linguagem simples:

1. **Status personalizado agora expira em 1 hora.** Quem precisar de mais tempo,
   escolhe o status de novo. Não é punição: é para o quadro da equipe parar de
   mostrar gente indisponível que já voltou.
2. **Alguns status vão pedir uma justificativa curta** no momento da escolha.
   O gestor define quais.
3. **"Ocupado" virou "Em atendimento"** e saiu da lista de escolha — ele sempre
   foi calculado pela agenda, e quem o escolhia acabava aparecendo como
   disponível, sem querer.

Vale dizer também que uma reunião de 3 horas passa a contar 1 hora por bloco
reafirmado. É uma escolha consciente de rigor, e as pessoas precisam saber disso
antes, não depois de ver o relatório.
