-- Contrato dos status operacionais + remoção do gatilho legado.
-- Feature: status-personalizados-ciclo-vida (T-007, AC-013, AC-018)
--
-- 1. 'ocupado' vira "Em atendimento" e passa a ser status de sistema — só o
--    rótulo muda, o identificador 'ocupado' permanece intacto: ele está fixo
--    em quatro pontos do sistema que não têm integridade referencial entre si
--    (fn_status_equipe_agora, o catálogo do cliente, os relatórios e os
--    filtros de widget). Renomear o slug quebraria os quatro em silêncio.
-- 2. Limpa os resíduos: linhas em status_disponibilidade travadas em 'ocupado'
--    por um escritor manual antigo (quando 'ocupado' ainda era selecionável),
--    já que nada mais as sobrescreve depois que os escritores legados somem.
-- 3. Remove o gatilho trg_concluir_atendimento e as funções órfãs
--    (fn_trigger_concluir_atendimento, fn_atualizar_status_em_atendimento) —
--    seu único efeito observável hoje é encerrar em silêncio um status
--    personalizado ativo, quebrando a garantia de vida de 1 hora do bloco.
--    O trigger precisa sair antes das funções (dependência de execução).

begin;

-- ─── 1. Rótulo muda, identificador permanece ───────────────────────────────
UPDATE status_disponibilidade_opcoes
SET label = 'Em atendimento',
    label_curto = 'atendimento',
    sistema = true
WHERE slug = 'ocupado';

-- ─── 2. Limpa resíduos de 'ocupado' travado por escritor manual antigo ─────
UPDATE status_disponibilidade
SET status = 'disponivel',
    origem = 'fallback',
    atualizado_em = now()
WHERE status = 'ocupado';

-- ─── 3. Remove o gatilho legado antes das funções que ele referencia ───────
DROP TRIGGER IF EXISTS trg_concluir_atendimento ON public.atendimentos;

DROP FUNCTION IF EXISTS public.fn_trigger_concluir_atendimento();

DROP FUNCTION IF EXISTS public.fn_atualizar_status_em_atendimento();

-- ─── 4. Desagenda o cron do escritor legado, se ainda existir ──────────────
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) THEN
    SELECT jobid
    INTO v_jobid
    FROM cron.job
    WHERE jobname = 'atualizar-status-em-atendimento'
    LIMIT 1;

    IF v_jobid IS NOT NULL THEN
      PERFORM cron.unschedule(v_jobid);
    END IF;
  END IF;
END $$;

commit;
