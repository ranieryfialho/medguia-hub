-- ─── Corrige a contagem dupla de "Em reunião" no relatório de Tempo Fábril ────
--
-- Diagnóstico (23/07/2026): existiam DOIS triggers ativos em status_disponibilidade
-- gravando o mesmo intervalo de reunião em tabelas diferentes:
--   1. fn_log_mudanca_status_disponibilidade → historico_status_disponibilidade (novo, com válvula de 24h/8h)
--   2. fn_trigger_historico_reuniao        → historico_reunioes (legado, sem válvula nenhuma)
-- O relatório soma as duas tabelas (kpis-tempo-fabril.ts) supondo que historico_reunioes
-- só tivesse dados anteriores à migração do trigger novo — mas o trigger legado nunca foi
-- desativado, então todo evento de reunião era contado 2x, e quando alguém esquecia de
-- voltar para "Disponível", a tabela legada (sem cron de segurança) inflava sem limite.
--
-- ─── 1. Desativa o trigger legado (dados históricos permanecem intactos) ──────
DROP TRIGGER IF EXISTS trg_historico_reuniao ON status_disponibilidade;
DROP FUNCTION IF EXISTS fn_trigger_historico_reuniao();

-- ─── 2. Diagnóstico: o pg_cron está disponível/instalado neste servidor? ──────
-- Rode esta query ANTES de decidir a parte 3. Se "instalado" vier false e
-- "disponivel_para_instalar" vier false também, o pg_cron não está nem
-- disponível na imagem do Postgres — nesse caso pule a parte 3 e use o
-- fallback por crontab do sistema operacional (comentado no fim do arquivo).
SELECT
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS instalado,
  EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') AS disponivel_para_instalar;

-- ─── 3. Só rode este bloco SE "disponivel_para_instalar" = true acima ─────────
-- Habilita a extensão (se ainda não estiver) e (re)agenda o job que fecha
-- status manuais (reunião, etc.) esquecidos. Roda a cada hora e fecha
-- qualquer status aberto há mais de 2h, capando a duração nesse limite —
-- reduz o estrago de um esquecimento de ~21h para no máximo ~2h.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'fechar-status-esquecidos';

SELECT cron.schedule(
  'fechar-status-esquecidos',
  '0 * * * *',
  $cron$
  UPDATE historico_status_disponibilidade
  SET fim = inicio + INTERVAL '2 hours'
  WHERE fim IS NULL
    AND inicio < NOW() - INTERVAL '2 hours';
  $cron$
);

-- ─── Fallback (SE pg_cron não estiver disponível na imagem) ───────────────────
-- Criar uma rota de API (ex.: src/app/api/cron/fechar-status-esquecidos/route.ts)
-- que rode a mesma query acima via supabase-js (service role), e chamar essa
-- rota periodicamente por um crontab do sistema operacional na VPS:
--
--   crontab -e
--   0 * * * * curl -s -X POST https://hub.medguia.cloud/api/cron/fechar-status-esquecidos \
--     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/fechar-status-esquecidos.log 2>&1
