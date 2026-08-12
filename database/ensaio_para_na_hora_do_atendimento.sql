-- ─── ENSAIO: o job encerra o bloco na hora marcada? ───────────────────────────
-- Feature: status-personalizados-ciclo-vida (T-028 / AC-037, AC-038, AC-042)
--
-- Prova o COMPORTAMENTO do comando que está em produção, contra o Postgres de
-- verdade. Os testes de T-028 são asserções sobre o TEXTO do SQL (ASM-002) —
-- garantem forma e ordem, não o que o banco faz. Este arquivo fecha essa lacuna.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- NÃO ALTERA NADA. Tudo roda dentro de BEGIN … ROLLBACK.
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Por que é seguro:
--   · o cenário é criado e desfeito dentro da mesma transação;
--   · os quatro gatilhos de notificação em `atendimentos` apenas INSEREM linha
--     em `notificacoes` — nenhuma chamada externa — e essas linhas também são
--     desfeitas pelo ROLLBACK;
--   · o profissional usado é escolhido entre os ATIVOS, e seu estado em
--     `status_disponibilidade` é restaurado pelo ROLLBACK junto com o resto.
--
-- COMO RODAR: cole o bloco inteiro, de BEGIN a ROLLBACK, numa única execução do
-- SQL Editor. Rodar por partes deixaria a transação aberta segurando lock em
-- `status_disponibilidade`, que o cron escreve a cada 10 minutos.
--
-- COMO LER: a saída do RAISE NOTICE traz cinco conferências. Todas precisam
-- dizer OK. Qualquer FALHOU é defeito real do comando em produção.

BEGIN;

DO $ensaio$
DECLARE
  v_prof       UUID;
  v_hora_marcada TIMESTAMPTZ;
  v_bloco_id   UUID;
  v_bloco2_id  UUID;
  v_fim_gravado TIMESTAMPTZ;
  v_fim_bloco2  TIMESTAMPTZ;
  v_status_final TEXT;
  v_origem_final TEXT;
BEGIN
  -- ─── Cenário ───────────────────────────────────────────────────────────────
  SELECT id INTO v_prof FROM profiles WHERE ativo = true ORDER BY id LIMIT 1;
  v_hora_marcada := date_trunc('hour', NOW()) - INTERVAL '1 hour';

  -- Bloco A: declarado 30 min ANTES da hora marcada. Deve ser encerrado.
  INSERT INTO historico_status_disponibilidade (profissional_id, status, inicio, fim)
  VALUES (v_prof, 'ensaio_status', v_hora_marcada - INTERVAL '30 minutes', NULL)
  RETURNING id INTO v_bloco_id;

  -- Estado ao vivo correspondente, sem disparar o gatilho de log (o bloco já
  -- foi inserido à mão acima).
  INSERT INTO status_disponibilidade (profissional_id, status, atualizado_em, origem)
  VALUES (v_prof, 'ensaio_status', v_hora_marcada - INTERVAL '30 minutes', 'manual')
  ON CONFLICT (profissional_id) DO UPDATE
    SET status = 'ensaio_status',
        atualizado_em = EXCLUDED.atualizado_em,
        origem = 'manual';

  -- Dois atendimentos elegíveis: o segundo mais cedo que o primeiro inserido,
  -- para provar que o MIN escolhe o mais cedo e não a ordem de inserção (AC-038).
  INSERT INTO atendimentos (profissional_id, paciente_id, data_agendamento, duracao_minutos, status, tipo)
  SELECT v_prof, pac.id, v_hora_marcada + INTERVAL '1 hour', 60, 'Confirmado', 'ENSAIO'
  FROM pacientes pac ORDER BY pac.id LIMIT 1;

  INSERT INTO atendimentos (profissional_id, paciente_id, data_agendamento, duracao_minutos, status, tipo)
  SELECT v_prof, pac.id, v_hora_marcada, 60, 'Aguardando', 'ENSAIO'
  FROM pacientes pac ORDER BY pac.id LIMIT 1;

  -- Atendimento CANCELADO ainda mais cedo. Não pode ser escolhido (AC-037).
  INSERT INTO atendimentos (profissional_id, paciente_id, data_agendamento, duracao_minutos, status, tipo)
  SELECT v_prof, pac.id, v_hora_marcada - INTERVAL '15 minutes', 60, 'Cancelado', 'ENSAIO'
  FROM pacientes pac ORDER BY pac.id LIMIT 1;

  -- ─── Comando EXATO do job em produção ──────────────────────────────────────
  WITH blocos_com_atendimento AS (
    SELECT h.id                     AS historico_id,
           h.profissional_id        AS profissional_id,
           MIN(a.data_agendamento)  AS hora_marcada
    FROM historico_status_disponibilidade h
    JOIN public.atendimentos a
      ON (a.profissional_id = h.profissional_id OR a.fisioterapeuta_id = h.profissional_id)
    WHERE h.fim IS NULL
      AND a.data_agendamento >= h.inicio
      AND a.data_agendamento <= NOW()
      AND lower(a.status) IN (
        'confirmado', 'aguardando', 'aguardando consulta', 'em atendimento',
        'concluído', 'concluido'
      )
    GROUP BY h.id, h.profissional_id
  ),
  fechados_pela_agenda AS (
    UPDATE historico_status_disponibilidade h
    SET fim = b.hora_marcada
    FROM blocos_com_atendimento b
    WHERE h.id = b.historico_id
    RETURNING h.profissional_id
  )
  UPDATE status_disponibilidade sd
  SET status = 'disponivel',
      atualizado_em = NOW(),
      origem = 'agenda'
  FROM fechados_pela_agenda f
  WHERE sd.profissional_id = f.profissional_id;

  -- ─── Conferências ──────────────────────────────────────────────────────────
  SELECT fim INTO v_fim_gravado
  FROM historico_status_disponibilidade WHERE id = v_bloco_id;

  SELECT status, origem INTO v_status_final, v_origem_final
  FROM status_disponibilidade WHERE profissional_id = v_prof;

  RAISE NOTICE '─────────────────────────────────────────────';
  RAISE NOTICE 'hora marcada esperada : %', v_hora_marcada;
  RAISE NOTICE 'fim gravado no bloco  : %', v_fim_gravado;
  RAISE NOTICE '─────────────────────────────────────────────';

  RAISE NOTICE '1. AC-038 fecha na hora marcada, nao em NOW() ..... %',
    CASE WHEN v_fim_gravado = v_hora_marcada THEN 'OK' ELSE 'FALHOU' END;

  RAISE NOTICE '2. AC-038 MIN escolhe o atendimento mais cedo ..... %',
    CASE WHEN v_fim_gravado = v_hora_marcada THEN 'OK'
         WHEN v_fim_gravado = v_hora_marcada + INTERVAL '1 hour' THEN 'FALHOU (pegou o mais tarde)'
         ELSE 'FALHOU' END;

  RAISE NOTICE '3. AC-037 atendimento cancelado nao encerra bloco . %',
    CASE WHEN v_fim_gravado > v_hora_marcada - INTERVAL '15 minutes' THEN 'OK'
         ELSE 'FALHOU (usou o cancelado)' END;

  RAISE NOTICE '4. AC-037 profissional deixa de ter declaracao .... %',
    CASE WHEN v_status_final = 'disponivel' AND v_origem_final = 'agenda' THEN 'OK'
         ELSE 'FALHOU (status=' || v_status_final || ', origem=' || v_origem_final || ')' END;

  RAISE NOTICE '5. AC-038 o trigger de log nao sobrescreveu o fim .. %',
    CASE WHEN v_fim_gravado = v_hora_marcada THEN 'OK'
         ELSE 'FALHOU (ordem invertida: fim virou NOW())' END;

  -- ─── AC-042: bloco declarado DEPOIS da hora marcada não é tocado ───────────
  INSERT INTO historico_status_disponibilidade (profissional_id, status, inicio, fim)
  VALUES (v_prof, 'ensaio_status_2', v_hora_marcada + INTERVAL '10 minutes', NULL)
  RETURNING id INTO v_bloco2_id;

  WITH blocos_com_atendimento AS (
    SELECT h.id AS historico_id, MIN(a.data_agendamento) AS hora_marcada
    FROM historico_status_disponibilidade h
    JOIN public.atendimentos a
      ON (a.profissional_id = h.profissional_id OR a.fisioterapeuta_id = h.profissional_id)
    WHERE h.fim IS NULL
      AND a.data_agendamento >= h.inicio
      AND a.data_agendamento <= NOW()
      AND lower(a.status) IN (
        'confirmado', 'aguardando', 'aguardando consulta', 'em atendimento',
        'concluído', 'concluido'
      )
    GROUP BY h.id
  )
  UPDATE historico_status_disponibilidade h
  SET fim = b.hora_marcada
  FROM blocos_com_atendimento b
  WHERE h.id = b.historico_id;

  SELECT fim INTO v_fim_bloco2
  FROM historico_status_disponibilidade WHERE id = v_bloco2_id;

  RAISE NOTICE '6. AC-042 nao grava fim anterior ao inicio ........ %',
    CASE WHEN v_fim_bloco2 IS NULL OR v_fim_bloco2 >= v_hora_marcada + INTERVAL '10 minutes'
         THEN 'OK' ELSE 'FALHOU (duracao negativa)' END;
  RAISE NOTICE '─────────────────────────────────────────────';
END
$ensaio$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Desfaz tudo. Se esta linha não rodar, a transação fica aberta segurando lock —
-- rode ROLLBACK manualmente.
-- ══════════════════════════════════════════════════════════════════════════════
ROLLBACK;
