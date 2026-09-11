-- T-035 (auditoria-exclusao-agendamentos): fn_excluir_atendimentos —
-- validações, bloqueio absoluto de "Concluído", snapshot, delete e limpeza da
-- linha órfã de série, tudo numa única transação.
--
-- Depende de:
--   database/agendamentos_auditoria_migration.sql (T-033)
--   database/motivos_exclusao_agendamento_migration.sql (T-034)
--
-- `SECURITY DEFINER` + `SET search_path = public, pg_temp` é obrigatório
-- (TDD 003, "Segurança") — sem isso, um schema malicioso no search_path do
-- chamador poderia sequestrar a resolução de nomes de tabela.
--
-- Ver .spec/features/auditoria-exclusao-agendamentos/spec.md
--   AC-046 — exclusão avulsa remove o atendimento e grava o log
--   AC-047 — exclusão pontual repõe sessão e distingue reposição de perda no log
--   AC-048 — série sem sessões concluídas é removida por inteiro, com a órfã
--   AC-049 — série com sessão concluída é recusada por inteiro
--   AC-050 — lote com sessão concluída é recusado por inteiro
--   AC-051 — lote totalmente pendente é excluído com log do escopo
--   AC-052 — bloqueio de "Concluído" vale em qualquer escopo
--   AC-053 — snapshot reflete o estado do atendimento antes da remoção
--   AC-054 — falha em qualquer etapa desfaz log e exclusão juntos
--   AC-056 — operador nulo ou inexistente bloqueia a exclusão
--   AC-057 — categoria de motivo inexistente ou inativa é recusada

CREATE OR REPLACE FUNCTION fn_excluir_atendimentos(
  p_ids               UUID[],
  p_acao              TEXT,
  p_motivo_categoria  TEXT,
  p_motivo_observacao TEXT,
  p_usuario_id        UUID,
  p_usuario_nome      TEXT
)
RETURNS TABLE (excluidos INT, serie_removida BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exige_observacao   BOOLEAN;
  v_qtd_concluidos     INT;
  v_qtd_excluidos      INT;
  v_agendamento_ids    UUID[];
  v_agendamento_id     UUID;
  v_serie_removida     BOOLEAN := false;
  v_encaminhados_ids   UUID[];
  v_ids_completo       UUID[];
BEGIN
  -- 1. AC-056: exclusão anônima é proibida — operador nulo ou inexistente
  -- na base de perfis bloqueia a operação inteira antes de qualquer leitura
  -- de atendimento.
  IF p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Operador não identificado: exclusão recusada.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_usuario_id) THEN
    RAISE EXCEPTION 'Operador não encontrado: exclusão recusada.';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum atendimento informado para exclusão.';
  END IF;

  -- 2. AC-057: a categoria de motivo precisa existir no catálogo e estar ativa.
  SELECT exige_observacao INTO v_exige_observacao
  FROM motivos_exclusao_agendamento
  WHERE slug = p_motivo_categoria AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoria de motivo inválida ou inativa: %', p_motivo_categoria;
  END IF;

  -- 3. Reforço no servidor da regra de "outros" do modal (AC-045): a
  -- validação do front-end não pode ser a única linha de defesa.
  IF v_exige_observacao AND (p_motivo_observacao IS NULL OR trim(p_motivo_observacao) = '') THEN
    RAISE EXCEPTION 'Observação obrigatória para a categoria "%".', p_motivo_categoria;
  END IF;

  -- Encaminhamento consulta médica -> pré/pós-consulta de fisioterapia
  -- (database/pre_consulta_fisio_migration.sql): excluir a consulta médica de
  -- origem precisa levar a pré/pós-consulta pendente junto, senão ela fica
  -- órfã na fila de /pre-consultas. Se a pré/pós-consulta já foi realizada,
  -- vale a mesma trava de "Concluído" abaixo — nesse caso a exclusão da
  -- origem é recusada por inteiro, em vez de apagar um atendimento já feito.
  SELECT ARRAY_AGG(DISTINCT id) INTO v_encaminhados_ids
  FROM atendimentos
  WHERE agendamento_origem_id = ANY(p_ids);

  v_ids_completo := p_ids || COALESCE(v_encaminhados_ids, ARRAY[]::UUID[]);

  -- 4. AC-049, AC-050, AC-052: bloqueio absoluto de "Concluído" (ASM-011) —
  -- qualquer alvo concluído no escopo (incluindo pré/pós-consultas
  -- encaminhadas) aborta a operação inteira, sem exclusão parcial dos demais.
  SELECT COUNT(*) INTO v_qtd_concluidos
  FROM atendimentos
  WHERE id = ANY(v_ids_completo) AND status = 'Concluído';

  IF v_qtd_concluidos > 0 THEN
    RAISE EXCEPTION 'Exclusão recusada: % atendimento(s) já concluído(s) no escopo.', v_qtd_concluidos;
  END IF;

  -- Séries afetadas, capturadas ANTES do delete — depois de apagar as linhas
  -- de `atendimentos` não há mais como descobrir de qual `agendamento_id`
  -- elas vieram.
  SELECT ARRAY_AGG(DISTINCT agendamento_id) INTO v_agendamento_ids
  FROM atendimentos
  WHERE id = ANY(v_ids_completo) AND agendamento_id IS NOT NULL;

  -- 5. AC-053: o snapshot é gravado ANTES do delete, com os dados do
  -- atendimento como estavam. O log entra na mesma transação da exclusão —
  -- se qualquer passo daqui pra frente falhar, o INSERT abaixo desfaz junto
  -- (AC-054).
  INSERT INTO agendamentos_auditoria (
    acao, motivo_categoria, motivo_observacao, usuario_id, usuario_nome,
    paciente_id, paciente_nome, profissional_id, profissional_nome,
    atendimento_id, agendamento_id, dados_agendamento
  )
  SELECT
    p_acao,
    p_motivo_categoria,
    NULLIF(trim(p_motivo_observacao), ''),
    p_usuario_id,
    p_usuario_nome,
    a.paciente_id,
    pac.nome,
    a.profissional_id,
    prof.full_name,
    a.id,
    a.agendamento_id,
    jsonb_build_object(
      'data_agendamento', a.data_agendamento,
      'duracao_minutos', a.duracao_minutos,
      'status', a.status,
      'tipo', a.tipo,
      'numero_sessao', a.numero_sessao,
      'total_sessoes', a.total_sessoes,
      'observacoes', a.observacoes
    )
  FROM atendimentos a
  LEFT JOIN pacientes pac ON pac.id = a.paciente_id
  LEFT JOIN profiles prof ON prof.id = a.profissional_id
  WHERE a.id = ANY(v_ids_completo);

  -- 6. AC-046, AC-048, AC-051: exclusão física do escopo (incluindo
  -- pré/pós-consultas encaminhadas pelas consultas médicas do escopo),
  -- depois do log já gravado na mesma transação.
  DELETE FROM atendimentos WHERE id = ANY(v_ids_completo);
  GET DIAGNOSTICS v_qtd_excluidos = ROW_COUNT;

  IF v_qtd_excluidos = 0 THEN
    RAISE EXCEPTION 'Nenhum atendimento foi removido — verifique os ids informados.';
  END IF;

  -- 7. AC-048: limpa a linha órfã em `agendamentos`, para cada série do
  -- escopo que ficou sem nenhum atendimento vinculado.
  IF v_agendamento_ids IS NOT NULL THEN
    FOREACH v_agendamento_id IN ARRAY v_agendamento_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM atendimentos WHERE agendamento_id = v_agendamento_id) THEN
        DELETE FROM agendamentos WHERE id = v_agendamento_id;
        v_serie_removida := true;
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_qtd_excluidos, v_serie_removida;
END;
$$;

-- EXECUTE só para service_role e authenticated — nunca para anon (TDD 003,
-- "Segurança"). As quatro Server Actions de exclusão chamam via `supabaseAdmin`
-- (service_role); `authenticated` fica concedido para eventual chamada direta
-- autenticada, sem abrir para o público.
REVOKE ALL ON FUNCTION fn_excluir_atendimentos(UUID[], TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_excluir_atendimentos(UUID[], TEXT, TEXT, TEXT, UUID, TEXT) TO service_role, authenticated;
