-- ─── Diagnóstico: qual versão de fn_status_equipe_agora está no ar? ───────────
-- Feature: status-personalizados-ciclo-vida (T-021 / AC-030)
--
-- SOMENTE LEITURA.
--
-- A PERGUNTA. Existem duas versões da função no repositório, e a diferença
-- decide se o contador regressivo funciona para status personalizados:
--
--   · fn_status_equipe_agora_v2.sql (09/07)
--       regra 2:       WHEN sd.status = 'reuniao' THEN 'reuniao'
--       atualizado_em: WHEN sd.status = 'reuniao' THEN sd.atualizado_em ELSE now()
--     → status personalizado NÃO é preservado: quem está em hora administrativa
--       aparece como 'disponivel'/'ausente', e o timestamp devolvido é now().
--       O contador ficaria eternamente em 2h00, sem nunca descer.
--
--   · status_disponibilidade_opcoes_migration.sql (13/07)
--       regra 2:       WHEN sd.status NOT IN ('disponivel','ausente','ocupado')
--                        THEN sd.status
--       atualizado_em: mesma condição → COALESCE(sd.atualizado_em, v_agora)
--     → qualquer status criado pelo gestor é preservado, com o timestamp real.
--
-- ESPERADO: versao_13_07 = true e versao_09_07_hardcoded = false.

SELECT
  -- A regra 2 aceita qualquer status personalizado?
  prosrc LIKE '%NOT IN (''disponivel'', ''ausente'', ''ocupado'')%'
    AS versao_13_07,

  -- Ou está presa a 'reuniao'?
  prosrc LIKE '%WHEN sd.status = ''reuniao'' THEN ''reuniao''%'
    AS versao_09_07_hardcoded,

  -- O atualizado_em preserva o timestamp real de status personalizado?
  -- É disso que o contador regressivo depende. Se vier false, o contador
  -- mostra 2h00 fixo para todo mundo em status personalizado.
  prosrc LIKE '%THEN COALESCE(sd.atualizado_em, v_agora)%'
    AS preserva_timestamp,

  pg_get_function_identity_arguments(p.oid) AS assinatura
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'fn_status_equipe_agora';

-- ─── Contraprova direta ───────────────────────────────────────────────────────
-- Passa pela função os ids de quem está em status personalizado AGORA e compara
-- com a tabela crua. Se a função estiver certa, `status_resolvido` repete
-- `status_declarado` (salvo quem tem atendimento em curso, que vira 'ocupado')
-- e `atualizado_em_resolvido` repete `atualizado_em_declarado`.
--
-- Se `atualizado_em_resolvido` vier ~agora enquanto o declarado é de horas
-- atrás, é a versão de 09/07 no ar — e o contador está quebrado.
WITH declarados AS (
  SELECT sd.profissional_id, sd.status, sd.atualizado_em
  FROM status_disponibilidade sd
  JOIN profiles pr ON pr.id = sd.profissional_id
  WHERE sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
    AND pr.ativo
)
SELECT d.profissional_id,
       pr.full_name,
       d.status                AS status_declarado,
       f.status                AS status_resolvido,
       d.atualizado_em         AS atualizado_em_declarado,
       f.atualizado_em         AS atualizado_em_resolvido,
       f.atualizado_em = d.atualizado_em AS timestamp_preservado
FROM declarados d
JOIN profiles pr ON pr.id = d.profissional_id
CROSS JOIN LATERAL fn_status_equipe_agora(ARRAY[d.profissional_id]) f
WHERE f.profissional_id = d.profissional_id;

-- ─── O catálogo tem os status personalizados que a tela precisa? ──────────────
-- A tela de Configurações → Disponibilidade não passava o catálogo e caía no
-- DEFAULT_OPCOES do código, que só conhece 4 slugs. Esta consulta mostra o que
-- ela passa a receber depois da correção — confira que os slugs em uso pelos
-- profissionais aparecem aqui.
SELECT slug, label, label_curto, cor, ordem, sistema, ativo, observacao_obrigatoria
FROM status_disponibilidade_opcoes
ORDER BY ordem, slug;
