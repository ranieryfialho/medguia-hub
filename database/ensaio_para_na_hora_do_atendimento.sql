-- ─── ENSAIO: o job encerra o bloco na hora marcada? ───────────────────────────
-- Feature: status-personalizados-ciclo-vida (T-028 / AC-037, AC-038, AC-042)
--
-- Prova o COMPORTAMENTO do comando que está em produção, contra o Postgres de
-- verdade. Os testes de T-028 são asserções sobre o TEXTO do SQL (ASM-002) —
-- garantem forma e ordem, não o que o banco faz.
--
-- ══════════════════════════════════════════════════════════════════════════════
--  COMO RODAR
--  1. Cole o arquivo inteiro no SQL Editor e execute.
--  2. O resultado aparece como ERRO, em vermelho, começando com "ENSAIO".
--     ISSO É O ESPERADO — leia o texto do erro, ele é o relatório.
--
--  POR QUE COMO ERRO: o SQL Editor do Supabase só exibe conjuntos de linhas e
--  mensagens de erro. `RAISE NOTICE` não aparece em lugar nenhum, e um `SELECT`
--  final não serve porque precisamos desfazer tudo antes de terminar.
--  `RAISE EXCEPTION` resolve os dois problemas de uma vez: mostra o texto E
--  aborta o bloco, desfazendo cada escrita feita aqui dentro.
--
--  NÃO ALTERA NADA. O bloco DO é um único comando: quando a exceção sobe, o
--  Postgres desfaz tudo que ele fez — inclusive as linhas que os gatilhos de
--  notificação tenham inserido. Não há transação para deixar aberta por engano,
--  ao contrário de um BEGIN…ROLLBACK digitado à mão.
--
--  COMO LER: seis conferências, todas precisam dizer OK. Qualquer FALHOU é
--  defeito real do comando que está rodando em produção agora.
-- ══════════════════════════════════════════════════════════════════════════════

DO $ensaio$
DECLARE
  v_prof          UUID;
  v_base          UUID;
  v_marcada       TIMESTAMPTZ;
  v_bloco         UUID;
  v_bloco2        UUID;
  v_fim           TIMESTAMPTZ;
  v_fim2          TIMESTAMPTZ;
  v_status        TEXT;
  v_origem        TEXT;
  v_saida         TEXT;
BEGIN
  -- ─── Escolha do cenário ────────────────────────────────────────────────────
  -- Profissional ativo, com linha em status_disponibilidade (para o gatilho de
  -- log disparar no UPDATE) e SEM bloco aberto (para não misturar com um caso
  -- real em andamento).
  SELECT sd.profissional_id INTO v_prof
  FROM status_disponibilidade sd
  JOIN profiles p ON p.id = sd.profissional_id AND p.ativo = true
  WHERE sd.status <> 'ensaio_status'
    AND NOT EXISTS (
      SELECT 1 FROM historico_status_disponibilidade h
      WHERE h.profissional_id = sd.profissional_id AND h.fim IS NULL
    )
  ORDER BY sd.profissional_id
  LIMIT 1;

  IF v_prof IS NULL THEN
    RAISE EXCEPTION 'ENSAIO ABORTADO: nenhum profissional ativo sem bloco aberto. Tente de novo em alguns minutos.';
  END IF;

  SELECT id INTO v_base FROM atendimentos ORDER BY data_agendamento DESC LIMIT 1;
  IF v_base IS NULL THEN
    RAISE EXCEPTION 'ENSAIO ABORTADO: não há atendimento nenhum para servir de molde.';
  END IF;

  v_marcada := date_trunc('hour', NOW()) - INTERVAL '1 hour';

  -- ─── Três atendimentos de mentira ──────────────────────────────────────────
  -- Copiados de uma linha real via jsonb, sobrescrevendo só o que importa. Isso
  -- evita depender de conhecer as colunas obrigatórias de `atendimentos`, que
  -- não estão versionadas neste repositório.
  --
  -- O mais cedo é inserido POR ÚLTIMO de propósito: se o comando pegasse a ordem
  -- de inserção em vez do MIN, a conferência 2 acusaria.
  INSERT INTO atendimentos
  SELECT * FROM jsonb_populate_record(NULL::atendimentos,
    to_jsonb(a) || jsonb_build_object(
      'id', gen_random_uuid(), 'profissional_id', v_prof, 'fisioterapeuta_id', NULL,
      'data_agendamento', v_marcada + INTERVAL '1 hour', 'status', 'Confirmado'))
  FROM atendimentos a WHERE a.id = v_base;

  INSERT INTO atendimentos
  SELECT * FROM jsonb_populate_record(NULL::atendimentos,
    to_jsonb(a) || jsonb_build_object(
      'id', gen_random_uuid(), 'profissional_id', v_prof, 'fisioterapeuta_id', NULL,
      'data_agendamento', v_marcada, 'status', 'Aguardando'))
  FROM atendimentos a WHERE a.id = v_base;

  -- Cancelado, e ainda mais cedo. Não pode ser escolhido (AC-037).
  INSERT INTO atendimentos
  SELECT * FROM jsonb_populate_record(NULL::atendimentos,
    to_jsonb(a) || jsonb_build_object(
      'id', gen_random_uuid(), 'profissional_id', v_prof, 'fisioterapeuta_id', NULL,
      'data_agendamento', v_marcada - INTERVAL '15 minutes', 'status', 'Cancelado'))
  FROM atendimentos a WHERE a.id = v_base;

  -- ─── Bloco aberto, criado pelo gatilho de verdade ──────────────────────────
  -- Trocar o status faz `fn_log_mudanca_status_disponibilidade` abrir o bloco,
  -- como acontece em produção. Só depois recuamos o início, para o bloco ficar
  -- 30 min antes da hora marcada.
  UPDATE status_disponibilidade
  SET status = 'ensaio_status', atualizado_em = NOW(), origem = 'manual'
  WHERE profissional_id = v_prof;

  UPDATE historico_status_disponibilidade
  SET inicio = v_marcada - INTERVAL '30 minutes'
  WHERE profissional_id = v_prof AND fim IS NULL
  RETURNING id INTO v_bloco;

  IF v_bloco IS NULL THEN
    RAISE EXCEPTION 'ENSAIO ABORTADO: o gatilho de log não abriu bloco ao trocar o status. Isso ja e um defeito — investigue fn_log_mudanca_status_disponibilidade.';
  END IF;

  -- ══ Comando EXATO do job em produção ══════════════════════════════════════
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
  -- ══════════════════════════════════════════════════════════════════════════

  SELECT fim INTO v_fim FROM historico_status_disponibilidade WHERE id = v_bloco;
  SELECT status, origem INTO v_status, v_origem
  FROM status_disponibilidade WHERE profissional_id = v_prof;

  -- ─── AC-042: bloco declarado DEPOIS da hora marcada não pode ser tocado ────
  UPDATE status_disponibilidade
  SET status = 'ensaio_status_2', atualizado_em = NOW(), origem = 'manual'
  WHERE profissional_id = v_prof;

  UPDATE historico_status_disponibilidade
  SET inicio = v_marcada + INTERVAL '10 minutes'
  WHERE profissional_id = v_prof AND fim IS NULL
  RETURNING id INTO v_bloco2;

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

  SELECT fim INTO v_fim2 FROM historico_status_disponibilidade WHERE id = v_bloco2;

  -- ─── Relatório ─────────────────────────────────────────────────────────────
  v_saida :=
    E'\n══════════ ENSAIO — nada foi alterado ══════════\n' ||
    'hora marcada esperada : ' || v_marcada || E'\n' ||
    'fim gravado no bloco  : ' || COALESCE(v_fim::TEXT, '(nao fechou)') || E'\n' ||
    E'───────────────────────────────────────────────\n' ||

    '1. AC-038 fecha na hora marcada, nao em NOW() ... ' ||
    CASE WHEN v_fim = v_marcada THEN 'OK'
         WHEN v_fim IS NULL THEN 'FALHOU (bloco nao foi fechado)'
         ELSE 'FALHOU (gravou ' || v_fim || ')' END || E'\n' ||

    '2. AC-038 MIN pega o atendimento mais cedo ...... ' ||
    CASE WHEN v_fim = v_marcada THEN 'OK'
         WHEN v_fim = v_marcada + INTERVAL '1 hour' THEN 'FALHOU (pegou o mais tarde)'
         ELSE 'FALHOU' END || E'\n' ||

    '3. AC-037 cancelado nao encerra bloco ........... ' ||
    CASE WHEN v_fim IS NULL THEN 'FALHOU (bloco nao fechou)'
         WHEN v_fim = v_marcada - INTERVAL '15 minutes' THEN 'FALHOU (usou o cancelado)'
         ELSE 'OK' END || E'\n' ||

    '4. AC-037 a declaracao e apagada ................ ' ||
    CASE WHEN v_status = 'disponivel' AND v_origem = 'agenda' THEN 'OK'
         ELSE 'FALHOU (status=' || COALESCE(v_status,'null') ||
              ', origem=' || COALESCE(v_origem,'null') || ')' END || E'\n' ||

    '5. AC-038 gatilho de log nao sobrescreveu o fim . ' ||
    CASE WHEN v_fim = v_marcada THEN 'OK'
         WHEN v_fim > NOW() - INTERVAL '2 minutes' THEN 'FALHOU (ordem invertida: fim virou NOW())'
         ELSE 'FALHOU' END || E'\n' ||

    '6. AC-042 nao grava fim anterior ao inicio ...... ' ||
    CASE WHEN v_fim2 IS NULL OR v_fim2 >= v_marcada + INTERVAL '10 minutes' THEN 'OK'
         ELSE 'FALHOU (duracao negativa: fim=' || v_fim2 || ')' END || E'\n' ||
    E'═══════════════════════════════════════════════';

  -- Mostra o relatório E desfaz tudo, no mesmo gesto.
  RAISE EXCEPTION '%', v_saida;
END
$ensaio$;
