# Roteiro de Aplicação em Produção — Auditoria de Exclusão de Agendamentos

Gerado em: 2026-08-25

> feature: auditoria-exclusao-agendamentos · T-042
> Ver `.spec/features/auditoria-exclusao-agendamentos/spec.md`, PRD 003, RFC 003, TDD 003.

## Objetivo

Aplicar as migrations de T-033, T-034 e T-035 no banco de produção
(`supabase.medguia.cloud`, self-hosted) e validar manualmente, com SQL puro no
SQL Editor do Studio, os cenários que os testes estáticos de `test/sql/` não
conseguem provar porque não executam Postgres:

- os 4 escopos de exclusão funcionando de ponta a ponta (avulso, pontual,
  série completa, lote);
- as 2 recusas do trigger de append-only (`UPDATE` e `DELETE`), inclusive
  usando a chave de `service_role`;
- as recusas da função transacional: concluído bloqueado em qualquer escopo,
  operador nulo/inexistente, motivo inexistente/inativo, e o "tudo ou nada"
  de um lote misto.

Este roteiro não substitui `test/sql/agendamentos-auditoria.test.ts`,
`test/sql/fn-excluir-atendimentos.test.ts` nem
`test/sql/auditoria-exclusao.test.ts` (T-036) — aqueles provam a **forma** do
SQL estaticamente; este roteiro prova o **comportamento** rodando contra um
Postgres real.

## Pré-requisitos

- Acesso ao Studio do Supabase self-hosted (`supabase.medguia.cloud`) com
  permissão de SQL Editor.
- Migrations aplicadas nesta ordem exata (dependências declaradas em
  `tasks.md`):
  1. `database/agendamentos_auditoria_migration.sql` (T-033)
  2. `database/motivos_exclusao_agendamento_migration.sql` (T-034)
  3. `database/fn_excluir_atendimentos_migration.sql` (T-035)
- Um paciente e um profissional de teste já existentes na base (não crie
  pacientes fictícios em produção — reutilize um registro de teste conhecido
  ou um paciente já usado em homologações anteriores).
- Um `usuario_id` válido: o `id` de um profile existente em `profiles`.

## Fase 1 — Aplicar as migrations

No SQL Editor do Studio, nesta ordem:

```sql
-- 1) T-033
-- cole o conteúdo de database/agendamentos_auditoria_migration.sql
```

```sql
-- 2) T-034
-- cole o conteúdo de database/motivos_exclusao_agendamento_migration.sql
```

```sql
-- 3) T-035
-- cole o conteúdo de database/fn_excluir_atendimentos_migration.sql
```

Confirme que as três rodaram sem erro e que o catálogo de motivos foi
semeado:

```sql
SELECT slug, ativo, exige_observacao FROM motivos_exclusao_agendamento ORDER BY slug;
```

Esperado: 6 linhas, com `outros` tendo `exige_observacao = true`.

## Fase 2 — Preparar dados de teste

Anote os ids que vai usar no roteiro (ajuste para dados reais do seu
ambiente):

```sql
-- operador de teste (precisa existir em profiles)
SELECT id, full_name FROM profiles LIMIT 1;
```

```sql
-- paciente e profissional de teste
SELECT id, nome FROM pacientes LIMIT 1;
SELECT id, full_name FROM profiles WHERE full_name IS NOT NULL LIMIT 1;
```

Guarde `v_usuario_id`, `v_paciente_id`, `v_profissional_id` para os blocos
abaixo.

## Fase 3 — Validar os 4 escopos (caminho feliz)

### 3.1 Avulso — AC-046

```sql
-- crie um atendimento avulso pendente de teste
INSERT INTO atendimentos (paciente_id, profissional_id, data_agendamento, duracao_minutos, status, tipo)
VALUES ('<v_paciente_id>', '<v_profissional_id>', now() + interval '1 day', 50, 'Aguardando', 'Avulso')
RETURNING id;
```

```sql
SELECT * FROM fn_excluir_atendimentos(
  ARRAY['<id_retornado>']::UUID[],
  'exclusao_avulso',
  'desistencia_paciente',
  NULL,
  '<v_usuario_id>',
  'Teste Roteiro T-042'
);
```

Esperado: `excluidos = 1`. Confirme o log:

```sql
SELECT acao, motivo_categoria, usuario_nome, dados_agendamento
FROM agendamentos_auditoria
ORDER BY criado_em DESC LIMIT 1;
```

### 3.2 Pontual de recorrência — AC-047

Repita o fluxo acima usando um atendimento com `agendamento_id` preenchido
(parte de uma série já existente) e ação `exclusao_sessao_recorrente`.
Confirme que o log grava `numero_sessao` e `total_sessoes` no snapshot.

### 3.3 Série completa sem concluídos — AC-048

Selecione todos os `id` de uma série 100% pendente e chame a função com
`exclusao_serie_completa`. Confirme que a linha em `agendamentos` (a série)
também some:

```sql
SELECT * FROM agendamentos WHERE id = '<agendamento_id_da_serie>';
```

Esperado: 0 linhas.

### 3.4 Lote totalmente pendente — AC-051

Selecione um conjunto arbitrário de `id`s pendentes (não precisam ser da
mesma série) e chame com `exclusao_lote`. Confirme `excluidos` igual à
quantidade enviada e um ou mais registros de log com a mesma ação.

## Fase 4 — Validar as recusas da função transacional

### 4.1 @spec:AC-049 — série com sessão concluída é recusada por inteiro

```sql
-- marque uma sessão da série de teste como Concluído
UPDATE atendimentos SET status = 'Concluído' WHERE id = '<uma_sessao_da_serie>';

SELECT * FROM fn_excluir_atendimentos(
  ARRAY(SELECT id FROM atendimentos WHERE agendamento_id = '<agendamento_id_da_serie>'),
  'exclusao_serie_completa', 'desistencia_paciente', NULL, '<v_usuario_id>', 'Teste Roteiro T-042'
);
```

Esperado: erro `Exclusão recusada: ... já concluído(s) no escopo.` Confirme
que **nenhuma** linha da série sumiu e que **nenhum** log novo foi gravado:

```sql
SELECT count(*) FROM atendimentos WHERE agendamento_id = '<agendamento_id_da_serie>';
SELECT count(*) FROM agendamentos_auditoria WHERE criado_em > now() - interval '2 minutes';
```

### 4.2 @spec:AC-050 — lote com sessão concluída é recusado por inteiro

Monte um array de `id`s onde pelo menos um está `Concluído` e chame com
`exclusao_lote`. Esperado: mesmo erro de bloqueio, e **todos** os itens do
lote (inclusive os pendentes) continuam existindo em `atendimentos`.

### 4.3 @spec:AC-052 — bloqueio de concluído vale nos 4 escopos

Repita 4.1/4.2 substituindo a ação por `exclusao_avulso` e
`exclusao_sessao_recorrente` sobre um único atendimento `Concluído`.
Esperado: mesma recusa nos 4 valores de `p_acao`.

### 4.4 @spec:AC-054 — falha em qualquer etapa desfaz log e exclusão juntos

Reaproveite o cenário 4.2 (lote misto, um item concluído). Antes da chamada,
anote `SELECT count(*) FROM agendamentos_auditoria;`. Depois da chamada
(que deve falhar), rode a mesma contagem — precisa estar **igual**, e
`SELECT count(*) FROM atendimentos WHERE id = ANY(ARRAY[...])` precisa
mostrar todos os ids do lote, inclusive os pendentes que seriam removidos se
a operação tivesse sido parcial.

### 4.5 @spec:AC-056 — operador nulo ou inexistente bloqueia a exclusão

```sql
-- operador nulo
SELECT * FROM fn_excluir_atendimentos(
  ARRAY['<id_pendente_qualquer>']::UUID[], 'exclusao_avulso', 'desistencia_paciente', NULL, NULL, NULL
);
-- esperado: 'Operador não identificado: exclusão recusada.'

-- operador inexistente
SELECT * FROM fn_excluir_atendimentos(
  ARRAY['<id_pendente_qualquer>']::UUID[], 'exclusao_avulso', 'desistencia_paciente', NULL,
  '00000000-0000-0000-0000-000000000000', 'Fantasma'
);
-- esperado: 'Operador não encontrado: exclusão recusada.'
```

Confirme nos dois casos que o atendimento continua em `atendimentos` e que
nenhum log foi gravado.

### 4.6 @spec:AC-057 — categoria de motivo inexistente ou inativa é recusada

```sql
-- categoria inexistente
SELECT * FROM fn_excluir_atendimentos(
  ARRAY['<id_pendente_qualquer>']::UUID[], 'exclusao_avulso', 'categoria_que_nao_existe', NULL,
  '<v_usuario_id>', 'Teste Roteiro T-042'
);
-- esperado: 'Categoria de motivo inválida ou inativa: categoria_que_nao_existe'

-- categoria inativa
UPDATE motivos_exclusao_agendamento SET ativo = false WHERE slug = 'desistencia_paciente';

SELECT * FROM fn_excluir_atendimentos(
  ARRAY['<id_pendente_qualquer>']::UUID[], 'exclusao_avulso', 'desistencia_paciente', NULL,
  '<v_usuario_id>', 'Teste Roteiro T-042'
);
-- esperado: mesmo erro de categoria inválida ou inativa

-- reative a categoria ao final do teste
UPDATE motivos_exclusao_agendamento SET ativo = true WHERE slug = 'desistencia_paciente';
```

## Fase 5 — Validar as 2 recusas do trigger de append-only

Use um registro de log já existente (por exemplo, o gravado na Fase 3.1).

### 5.1 @spec:AC-055 — UPDATE é recusado, inclusive com service_role

No SQL Editor (que roda como superusuário/postgres, equivalente ao poder de
`service_role` para este teste — o trigger não distingue role, só a
operação):

```sql
UPDATE agendamentos_auditoria
SET motivo_observacao = 'tentativa de alteração'
WHERE id = '<id_de_um_log_existente>';
```

Esperado: erro `RAISE EXCEPTION` do trigger `trg_auditoria_append_only`, e o
registro permanece inalterado:

```sql
SELECT motivo_observacao FROM agendamentos_auditoria WHERE id = '<id_de_um_log_existente>';
```

### 5.2 @spec:AC-055 — DELETE é recusado, inclusive com service_role

```sql
DELETE FROM agendamentos_auditoria WHERE id = '<id_de_um_log_existente>';
```

Esperado: mesmo erro do trigger. Confirme que a linha continua existindo:

```sql
SELECT count(*) FROM agendamentos_auditoria WHERE id = '<id_de_um_log_existente>';
```

Esperado: `1`.

> Nota: se quiser reforçar que a recusa independe da role autenticada (e não
> só do superusuário do SQL Editor), repita 5.1/5.2 usando a service role key
> via `curl` contra o endpoint REST (`PATCH`/`DELETE` em
> `/rest/v1/agendamentos_auditoria`) com header
> `apikey: <SUPABASE_SERVICE_ROLE_KEY>` — o trigger dispara antes de qualquer
> checagem de RLS, então o resultado é o mesmo erro.

## Fase 6 — Limpeza dos dados de teste

Apague manualmente (via SQL, fora da função — este é ambiente de teste, não
produção real) qualquer atendimento/paciente/log criado só para este
roteiro, para não poluir o painel gerencial (`/relatorios/auditoria-exclusoes`)
nem a aba "Logs" de pacientes reais.

## Checklist de assinatura

| Cenário | AC | Resultado (`PASS`/`FAIL`) | Executado por | Data |
|---|---|---|---|---|
| Avulso — caminho feliz | AC-046 | PASS | Raniery (via Claude) | 2026-08-25 |
| Pontual de recorrência — caminho feliz | AC-047 | PASS | Raniery (via Claude) | 2026-08-25 |
| Série completa sem concluídos | AC-048 | PASS | Raniery (via Claude) | 2026-08-25 |
| Lote totalmente pendente | AC-051 | PASS | Raniery (via Claude) | 2026-08-25 |
| Série com sessão concluída é recusada por inteiro | AC-049 | PASS | Raniery (via Claude) | 2026-08-25 |
| Lote com sessão concluída é recusado por inteiro | AC-050 | PASS | Raniery (via Claude) | 2026-08-25 |
| Bloqueio de concluído nos 4 escopos | AC-052 | PASS | Raniery (via Claude) | 2026-08-25 |
| Falha em qualquer etapa desfaz log e exclusão (tudo ou nada) | AC-054 | PASS | Raniery (via Claude) | 2026-08-25 |
| Operador nulo ou inexistente bloqueia a exclusão | AC-056 | PASS | Raniery (via Claude) | 2026-08-25 |
| Categoria de motivo inexistente ou inativa é recusada | AC-057 | PASS | Raniery (via Claude) | 2026-08-25 |
| Trigger recusa UPDATE no log | AC-055 | PASS | Raniery (via Claude) | 2026-08-25 |
| Trigger recusa DELETE no log | AC-055 | PASS | Raniery (via Claude) | 2026-08-25 |

Executado em produção (`supabase.medguia.cloud`) em 2026-08-25, usando o
paciente de teste "RANIERY FIALHO ARRUDA" (`feb13e50-aa1d-4ad5-9a6c-85576bb6ea5e`)
— dados fictícios de agenda removidos na Fase 6; os registros de log dos
testes (append-only, não removíveis) permanecem associados a esse paciente.

Duas correções feitas neste roteiro durante a execução:
- o slug de motivo `paciente_faltou`, usado nos exemplos originais, não
  existe no catálogo semeado por T-034 — trocado por `desistencia_paciente`
  em todas as ocorrências.
- o status `Pendente` usado no INSERT de exemplo viola
  `atendimentos_status_check` — trocado por `Aguardando` (valor real
  confirmado via `pg_get_constraintdef`).

Assinado por: Raniery  Data: 2026-08-25
